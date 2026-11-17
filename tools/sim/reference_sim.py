#!/usr/bin/env python3
"""Re: cursed reference combat model (milestone M2).

This model is the rule oracle for the web iteration. The combat code in
web/src/core must give the same results for every fight in expected.json.
The model reads all numbers from data/. It uses no randomness.

Usage, from the repo root:
  python3 tools/sim/reference_sim.py           print a report
  python3 tools/sim/reference_sim.py --write   rewrite tools/sim/expected.json

Rules
  Turn bar    Each tick, the gauge of each living unit increases by its Speed.
              A unit with gauge >= barLength is ready. If more than one unit
              is ready, the unit that crossed barLength first acts first:
              the largest (gauge - barLength) / Speed. If that is equal, the
              hero acts first, then the enemies from left to right.
              When a unit acts, its gauge decreases by barLength. The rest
              stays (overflow carries over). No tick happens while a unit is ready.
  Damage      ATK x power% x K / (K + DEF) x each multiplier%, rounded
              half up, at least 1. K is defenceConstant. HP is never below 0.
              Use integer math only, no floating point:
                num = ATK x power x K x m1 x m2 ...
                den = (K + DEF) x 100 x 100 x 100 ...   (one 100 per percent)
                damage = max(1, floor((2 x num + den) / (2 x den)))
  Rage        0 to rageMax. +rageOnHit each time the hero takes a hit,
              also when the hit is guarded. A skill with a negative "rage"
              value costs that much Rage and needs at least that much.
  Cooldown N  The skill cannot be used in the owner's next N turns.
  Free skill  Does not end the turn. Each skill at most once in a turn.
  Guard       Damage taken x damageTakenPct until the hero's next turn.
  Warcry      Damage dealt x atkPct for `turns` turn-ending actions, starting
              with the action that ends the current turn.
  Enemies     Attack the hero with power 1.0, except:
              pattern.every N: on each Nth own turn, do pattern.action instead.
                hex   hero gauge - knockback, not below 0. No damage.
                crush attack with pattern.power (a percent).
              onHit.rage: after the hit, change hero Rage by this value.
  End         Win when every enemy has HP 0. Loss when the hero has HP 0.

Policies in expected.json
  slash  Each turn, Slash the leftmost living enemy. Use nothing else.
  best   The plan with the best result: win, then most HP left, then fewest
         turns. A plan is a list of turns. A turn is a list of actions.
         An action is [skill, target]. target is an enemy index or null.
"""
import json
import sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
EXPECTED = Path(__file__).resolve().parent / "expected.json"

sys.setrecursionlimit(20000)


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


RULES = load("rules.json")
CLASSES = load("classes.json")
SKILLS = load("skills.json")
ENEMIES = load("enemies.json")
ENCOUNTERS = load("encounters.json")

BAR = RULES["barLength"]
K = RULES["defenceConstant"]
RAGE_MAX = RULES["rageMax"]
RAGE_ON_HIT = RULES["rageOnHit"]


def damage(atk, power, defence, *pcts):
    """Integer damage. power and each value in pcts are percents."""
    num = atk * power * K
    den = (K + defence) * 100
    for p in pcts:
        num *= p
        den *= 100
    return max(1, (2 * num + den) // (2 * den))


def clamp_rage(r):
    return max(0, min(RAGE_MAX, r))


class Fight:
    """State is a plain tuple so it can be a dictionary key.

    hero    = (hp, rage, gauge, cooldowns, guard, atk_up, turns)
    enemies = ((id, hp, gauge, own_turns), ...)
    """

    def __init__(self, hero_id, enemy_ids):
        self.hero = CLASSES[hero_id]
        self.skills = self.hero["skills"]
        self.enemy_ids = enemy_ids
        self.memo = {}

    def start(self):
        hero = (self.hero["hp"], 0, 0, tuple(0 for _ in self.skills), False, 0, 0)
        enemies = tuple((e, ENEMIES[e]["hp"], 0, 0) for e in self.enemy_ids)
        return (hero, enemies)

    # ---- turn bar -------------------------------------------------------
    def advance(self, state):
        """Run enemy actions until the hero's turn. Return the state at the
        start of the hero's turn, or None if the hero dies."""
        hero, enemies = state
        hp, rage, g, cds, guard, atk_up, turns = hero
        en = [list(e) for e in enemies]
        while True:
            ready = []
            if g >= BAR:
                ready.append((Fraction(g - BAR, self.hero["speed"]), 0, -1))
            for i, e in enumerate(en):
                if e[1] > 0 and e[2] >= BAR:
                    ready.append((Fraction(e[2] - BAR, ENEMIES[e[0]]["speed"]), 1 + i, i))
            if not ready:
                g += self.hero["speed"]
                for e in en:
                    if e[1] > 0:
                        e[2] += ENEMIES[e[0]]["speed"]
                continue
            ready.sort(key=lambda r: (-r[0], r[1]))
            who = ready[0][2]
            if who == -1:
                g -= BAR
                cds = tuple(max(0, c - 1) for c in cds)
                hero = (hp, rage, g, cds, False, atk_up, turns + 1)
                return (hero, tuple(tuple(e) for e in en))
            e = en[who]
            e[2] -= BAR
            e[3] += 1
            spec = ENEMIES[e[0]]
            pattern = spec.get("pattern")
            if pattern and e[3] % pattern["every"] == 0 and pattern["action"] == "hex":
                g = max(0, g - pattern["knockback"])
                continue
            power = 100
            if pattern and e[3] % pattern["every"] == 0 and pattern["action"] == "crush":
                power = pattern["power"]
            pcts = (SKILLS["guard"]["effect"]["damageTakenPct"],) if guard else ()
            hp = max(0, hp - damage(spec["atk"], power, self.hero["def"], *pcts))
            rage = clamp_rage(rage + RAGE_ON_HIT)
            if "onHit" in spec:
                rage = clamp_rage(rage + spec["onHit"].get("rage", 0))
            if hp <= 0:
                return None

    # ---- hero actions ---------------------------------------------------
    def actions(self, state, used):
        hero, enemies = state
        hp, rage, g, cds, guard, atk_up, turns = hero
        out = []
        for k, sid in enumerate(self.skills):
            s = SKILLS[sid]
            if cds[k] > 0 or sid in used:
                continue
            if s["rage"] < 0 and rage < -s["rage"]:
                continue
            if s["target"] == "enemy":
                seen = set()
                for i, e in enumerate(enemies):
                    if e[1] <= 0:
                        continue
                    sig = (e[0], e[1], e[2], e[3])
                    if sig in seen:
                        continue
                    seen.add(sig)
                    out.append((sid, i))
            else:
                out.append((sid, None))
        return out

    def apply(self, state, action):
        """Return (new_state, ends_turn)."""
        sid, target = action
        s = SKILLS[sid]
        hero, enemies = state
        hp, rage, g, cds, guard, atk_up, turns = hero
        en = [list(e) for e in enemies]
        k = self.skills.index(sid)
        atk = self.hero["atk"]
        pcts = (SKILLS["warcry"]["effect"]["atkPct"],) if atk_up > 0 else ()
        if s["target"] == "enemy":
            e = en[target]
            e[1] = max(0, e[1] - damage(atk, s["power"], ENEMIES[e[0]]["def"], *pcts))
        elif s["target"] == "allEnemies":
            for e in en:
                if e[1] > 0:
                    e[1] = max(0, e[1] - damage(atk, s["power"], ENEMIES[e[0]]["def"], *pcts))
        effect = s.get("effect")
        if effect and effect["kind"] == "guard":
            guard = True
        if effect and effect["kind"] == "atkUp":
            atk_up = effect["turns"]
        rage = clamp_rage(rage + s["rage"])
        if s["cooldown"] > 0:
            cds = tuple((s["cooldown"] + 1) if j == k else c for j, c in enumerate(cds))
        ends = not s["free"]
        if ends and atk_up > 0:
            atk_up -= 1
        return ((hp, rage, g, cds, guard, atk_up, turns), tuple(tuple(e) for e in en)), ends

    @staticmethod
    def won(state):
        return all(e[1] <= 0 for e in state[1])

    # ---- policies -------------------------------------------------------
    def run_slash(self):
        state = self.advance(self.start())
        while True:
            if state is None:
                return {"outcome": "loss"}
            target = next(i for i, e in enumerate(state[1]) if e[1] > 0)
            state, _ = self.apply(state, ("slash", target))
            if self.won(state):
                return self.result(state)
            state = self.advance(state)

    def best(self, state, used=()):
        key = (state, used)
        if key in self.memo:
            return self.memo[key]
        best = None
        for act in self.actions(state, used):
            nxt, ends = self.apply(state, act)
            if self.won(nxt):
                cand = ((1, nxt[0][0], -nxt[0][6]), [[list(act)]], nxt)
            elif not ends:
                sub = self.best(nxt, used + (act[0],))
                if sub is None:
                    continue
                plan = [[list(act)] + sub[1][0]] + sub[1][1:]
                cand = (sub[0], plan, sub[2])
            else:
                after = self.advance(nxt)
                if after is None:
                    cand = ((0, 0, -nxt[0][6]), [[list(act)]], None)
                else:
                    sub = self.best(after)
                    if sub is None:
                        continue
                    cand = (sub[0], [[list(act)]] + sub[1], sub[2])
            if best is None or cand[0] > best[0]:
                best = cand
        self.memo[key] = best
        return best

    def run_best(self):
        b = self.best(self.advance(self.start()))
        out = {"plan": b[1]}
        if b[2] is None:
            out["outcome"] = "loss"
        else:
            out.update(self.result(b[2]))
        return out

    def replay(self, plan):
        """Play a plan. Used to check that each plan is legal."""
        state = self.advance(self.start())
        for n, turn in enumerate(plan):
            used = ()
            for sid, target in turn:
                legal = any(
                    a[0] == sid and (a[1] == target or SKILLS[sid]["target"] == "enemy")
                    for a in self.actions(state, used)
                )
                assert legal, f"illegal action {sid} {target} in turn {n + 1}"
                if target is not None:
                    assert state[1][target][1] > 0, f"dead target {target} in turn {n + 1}"
                state, ends = self.apply(state, (sid, target))
                used += (sid,)
                if self.won(state):
                    return self.result(state)
                if ends:
                    break
            state = self.advance(state)
            if state is None:
                return {"outcome": "loss"}
        raise AssertionError("plan ended before the fight ended")

    @staticmethod
    def result(state):
        hp, rage, g, cds, guard, atk_up, turns = state[0]
        return {"outcome": "win", "heroTurns": turns, "heroHp": hp, "heroRage": rage}


def main():
    hero_id = "warrior"
    hero_hp = CLASSES[hero_id]["hp"]
    report = {"model": "tools/sim/reference_sim.py", "hero": hero_id, "encounters": []}
    for enc in ENCOUNTERS:
        f = Fight(hero_id, enc["enemies"])
        slash = f.run_slash()
        best = f.run_best()
        check = Fight(hero_id, enc["enemies"]).replay(best["plan"])
        assert check == {k: v for k, v in best.items() if k != "plan"}, (enc["id"], check, best)
        report["encounters"].append({"id": enc["id"], "slash": slash, "best": best})
        target = RULES["targetTurns"][enc["kind"]]

        def line(r):
            if r["outcome"] != "win":
                return "LOSS"
            lost = (hero_hp - r["heroHp"]) / hero_hp
            return f"{r['heroTurns']:2d} turns, HP lost {lost:4.0%}"

        print(f"{enc['name']:<18} target {target:2d} | slash: {line(slash)} | best: {line(best)}")
    if "--write" in sys.argv:
        with open(EXPECTED, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(report, fh, indent=2)
            fh.write("\n")
        print(f"wrote {EXPECTED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
