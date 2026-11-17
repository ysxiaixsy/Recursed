# Re: cursed: handoff to Claude Code

This file holds all build instructions for milestone M3. Read all of it at the start of each session.
If this file and another file disagree, this file wins. For fight results, `tools/sim/expected.json` wins.

The design is in `docs/GDD.md`, a snapshot of the live GDD that JP exports. It is background only: each instruction you need is in this file or in `data/`. If `docs/GDD.md` is missing, continue. S1 and A1 do not need it.

## 1. Start here

First session only:

1. Read this file, `CLAUDE.md`, and `docs/adr/0001-web-stack.md`.
2. Commit each file that git does not ignore to `main`, with the message `Add art test, shared data, reference combat model, ADR 0001, and handoff`. Push.
3. Start S1 (section 9) on a new branch, `s1-first-fight`. Work through its acceptance list.
4. Stop when S1 is ready for JP's phone test. Give JP the live URL and the report (section 6).

Later sessions: find the next stage in the status table (section 8) and continue from there.

## 2. The game in short

Re: cursed is a turn-based, permadeath dungeon RPG in pixel art. It is mobile first and portrait.
A hero goes down a dungeon, floor by floor. Each floor has 5 rooms and a boss. Fights use a turn bar: fast units act more often. After each boss, the hero evolves into a stronger class. A dead hero comes back in later runs as an enemy.

## 3. Goal of M3

A web build that JP plays on his phone: one Warrior run through floor 1, the Warden (the boss), an evolution, and floor 2.
It must answer one question: are the fights fun?

- **In:** Warrior. Curses Hunger and Glass. Floors 1 and 2. Rooms Fight, Elite, Rest, Treasure, Grave. The Warden. Evolution to Knight or Berserker. Items and consumables. Dead pool. Saves. Speed control. Phone and desktop.
- **Out, after M3:** Mage, Rogue, Acolyte. Greed and Echo. Event rooms. Party and Bind. Rare classes and the codex. Unlocks. Floors 3 and 4. Levels and experience. Sound. App stores.

## 4. Where things are

| Path | Content |
| --- | --- |
| `HANDOFF.md` | This file: all instructions, and the status table |
| `CLAUDE.md` | Short rules and commands for each session |
| `docs/adr/0001-web-stack.md` | The stack and the folder rules |
| `docs/GDD.md` | The design, as background |
| `data/` | All game numbers |
| `tools/sim/reference_sim.py` | The combat rules as code |
| `tools/sim/expected.json` | The fight results that `web/` must match |
| `art/`, `tools/art/` | Sprites, and the Aseprite Lua scripts that draw them |
| `art-test-brief.md`, `art/REPORT.md` | Art rules, and how to build and check art |
| `web/` | The web iteration. S1 creates it |

## 5. Rules for all work

1. `web/src/core` is plain TypeScript. It imports nothing from Phaser, the DOM, or the browser. `web/src/ui` draws the core state and sends player input to core.
2. A core function takes a state and an input. It returns a new state and a list of events. The ui plays the events as animation. The speed control changes only the animation time.
3. All game numbers come from `data/`. Code has no game numbers, except in tests.
4. Combat uses integer math and no randomness (section 7). Run generation uses a seeded random generator in core. Its state is part of the save.
5. The game state is plain JSON. A save is the state.
6. Read the current Phaser 4 docs before you write scene code. Most examples on the web are for Phaser 3.
7. After a change to a combat rule or to `data/`, run `python tools/sim/reference_sim.py` and put its output in the pull request. Update `expected.json` only with `--write`, never by hand. If a fight moves outside its target in `data/rules.json`, ask JP first.
8. Do not invent design. If a stage needs a design fact that is not in this file or in `data/`, stop and ask JP.

## 6. How to work and report

- Do one stage at a time, in the order of the status table. A1 can run at the same time as S1 and S2.
- Use one branch and one pull request for each stage. JP merges after his phone test.
- Check your work before you report:
  - `npm test`: the unit tests and the parity test.
  - `npm run build`: strict type check and build.
  - Playwright at a 390 x 844 viewport: a screenshot of each new screen. Look at each one.
- Report in the pull request: what works, what does not, the test results, the screenshots, and the live URL. Then update the status table in this file.
- Track progress in the status table. Create GitHub issues only if JP asks. (`CLAUDE.md` says that specs live in issues. For M3, this file is the spec.)
- To run A1 at the same time as S1, use a second folder. Two sessions in one folder change branches under each other:

  ```
  git worktree add ../Recursed-a1 -b a1-art
  ```

  Then open a second Claude Code session in `../Recursed-a1`.

## 7. Combat rules (exact)

`tools/sim/reference_sim.py` follows these rules. `web/src/core` must follow them too. The numbers are in `data/rules.json`, `data/classes.json`, `data/skills.json`, and `data/enemies.json`.

- **Turn bar.** Each tick, the gauge of each living unit increases by its Speed. A unit with a gauge of `barLength` or more is ready. No tick happens while a unit is ready.
  - If more than one unit is ready, the unit that crossed `barLength` first acts first: the largest (gauge − barLength) / Speed. Compare with integer cross-multiplication.
  - If that is equal, the hero acts first, then the enemies from left to right.
  - When a unit acts, its gauge decreases by `barLength`. The rest carries over.
- **Damage.** Integer math only. Power and each multiplier are percents. K is `defenceConstant`.

  ```
  num    = ATK x power x K x m1 x m2 ...
  den    = (K + DEF) x 100 x 100 x 100 ...   (one 100 for power, one for each multiplier)
  damage = max(1, floor((2 x num + den) / (2 x den)))
  ```

  HP never goes below 0.
- **Rage.** 0 to `rageMax`. The hero gains `rageOnHit` each time it takes a hit, also a guarded hit. A skill with a negative `rage` value costs that much Rage, and needs at least that much.
- **Cooldown N.** The skill cannot be used in the owner's next N turns.
- **Free skill.** It does not end the turn. Each skill can be used at most once in a turn.
- **Guard.** Damage taken x `damageTakenPct` until the hero's next turn.
- **Warcry.** Damage dealt x `atkPct` for `turns` turn-ending actions, starting with the action that ends the current turn.
- **Enemies** attack the hero with power 100, with these exceptions:
  - `pattern.every` N: on each Nth own turn, the enemy does `pattern.action` instead. `hex`: the hero's gauge decreases by `knockback`, not below 0, with no damage. `crush`: an attack with `pattern.power`.
  - `onHit.rage`: after the hit, the hero's Rage changes by that value.
- **End.** The fight is won when each enemy has 0 HP. It is lost when the hero has 0 HP.

## 8. Status

| Stage | State | Needs |
| --- | --- | --- |
| S1 First fight | In review: PR #1, live at https://ysxiaixsy.github.io/Recursed/?debug=1 | JP's phone test, then merge |
| A1 Art for the slice | Ready | |
| S2 One full floor | Waits for design | S1, and the "before S2" design in section 14 |
| S3 Evolution and floor 2 | Waits for design | S2, A1, and the "before S3" design |
| S4 The dungeon remembers | Waits for design | S2, and the "before S4" design |

## 9. S1 First fight

One fight from end to end: the code, the screen, the tests, and a live URL.

### What to build

- Set up `web/`: Vite, TypeScript (strict), Phaser 4, Vitest, Playwright. Add the `web/` commands to `CLAUDE.md`.
- `core/`: load and check `data/*.json`. Turn bar, damage, Rage, the 4 Warrior skills, free actions, cooldowns, enemy patterns (Hex, Crush, Rage drain), win and loss.
- `core/`: a pure function that gives the next 6 actors, for the turn order row.
- `ui/`: the battle screen. Use `art/export/battle_mockup.png` as the layout:
  - turn order row with the next 4 actors; enemies with HP bars; the Warrior with HP and Rage bars
  - 4 skill buttons with Rage cost, cooldown, and a mark for free actions; the text of the selected skill under them
  - tap a skill, then tap a target if the skill needs one (touch and mouse)
  - damage numbers; a warning one Warden turn before Crush
  - three 80 x 80 enemies must fit; use two rows if necessary
  - speed button: 1x, 2x, 3x
  - win and loss screens with "Fight again" and "Pick a fight"
- Debug picker at `?debug=1`: start any encounter from `data/encounters.json`.
- Game area 270 x 480, whole-number scale, nearest-neighbour pixels. Fill the rest of the screen with the background colour.
- Sprites: load `art/export/<sprite>.png`, where `<sprite>` is the unit's `sprite` field in `data/`, or its id if it has no such field. If the file does not exist, draw a placeholder: a box with the unit's name. Portraits for the turn order row follow the same rule, in `art/export/portraits/`. A1 adds the missing files while S1 runs.
- Text: A1 makes the bitmap fonts in `art/export/fonts/`. Until they exist, use a temporary pixel font with an open licence. Draw all text through one helper, so the change to the A1 fonts is one edit.
- GitHub Actions: on each push to `main`, build `web/` and publish it to GitHub Pages. The site is at `https://ysxiaixsy.github.io/Recursed/`, so set the Vite `base` to `/Recursed/`. If Pages is off, turn it on with `gh api`, or ask JP to set Settings > Pages > Source to GitHub Actions.

### Acceptance

- [ ] Parity test: for each encounter in `tools/sim/expected.json`, the `slash` policy and a replay of the `best` plan give the same `outcome`, `heroTurns`, `heroHp`, and `heroRage`.
- [ ] A test fails if a file in `web/src/core` imports `phaser` or uses `window` or `document`.
- [ ] `npm run build` passes.
- [ ] Playwright: open `?debug=1`, play `two_spiders` with taps, and win. Screenshots of the battle and the win screen at 390 x 844.
- [ ] The live URL works on JP's phone. JP plays `two_spiders` and `the_warden`, and says if his choices change the result.

### Out of scope

Run structure, saves, items, curses, new art.

## 10. A1 Art for the slice

Same rules as `art-test-brief.md`: palette, outline, light, automatic checks, and at most 3 rounds for each asset. The Aseprite path and the build commands are in `art/REPORT.md`.

### What to make

- Font first, because S1 uses a temporary font until then: body text at least 7 pixels tall. Export both fonts as bitmap fonts that Phaser 4 can load, to `art/export/fonts/`.
- Rename `monster` to `crypt_spider`: the source, the exports, and the names in `tools/art`. In the same pull request, remove the `sprite` field of `crypt_spider` in `data/enemies.json`. From then on, a sprite file name is the unit's id.
- Monsters: `bone_guard`, `hollow_acolyte`, and `rage_leech` at 80 x 80. `grave_rat` at 48 x 48, because it comes in groups of 3. `the_warden` at 128 x 128.
- Heroes: `knight` and `berserker` at 64 x 64, made from the Warrior design. Each must read as a Warrior evolution at a glance.
- A portrait of each unit for the turn order row, as in the mockup, in `art/export/portraits/`. Include the Warrior and the Crypt Spider.
- Background: less dither on the walls and the floor.
- Door icons for the room types, in `art/export/icons/`: fight, elite, rest, treasure, grave, boss.

### Acceptance

- [ ] `tools/art/check` passes for each new asset.
- [ ] One contact sheet PNG with all new sprites on the battle background, at 1x and 4x.
- [ ] JP accepts the look.

## 11. S2 One full floor

State: waits for the "before S2" design (section 14). Needs S1.

### What to build

- Title screen. Start screen: Warrior and one curse (Hunger or Glass).
- Floor 1: 5 rooms, then the Warden. Before each room, 2 or 3 doors show their room type.
- Room types: Fight, Elite, Rest, Treasure. (Grave comes in S4.)
- Rewards, items, consumables, and curse effects: as section 14 gives them when the design is done.
- Seeded run: the same seed and the same choices give the same run.
- Save after each player action. A reload restores the exact state, also in the middle of a fight. Closing the browser never undoes a choice. Death deletes the run save.
- Run summary: victory or death, rooms cleared, time, seed.
- PWA: installable, works offline, portrait.
- `npm run balance`: the best-play search from `reference_sim.py`, in TypeScript on top of core. It prints turns and HP loss for each encounter, for slash only and for best play.

### Acceptance

- [ ] Unit tests for seeded room generation, rewards, curses, save, and load.
- [ ] Save test: save in the middle of a fight, load, and finish the fight. The result is the same as with no save.
- [ ] Playwright: a scripted run with a fixed seed reaches the Warden.
- [ ] The `npm run balance` output is in the pull request.
- [ ] JP plays 3 runs on his phone and closes the browser in the middle of a fight once. He reports the time of each run.

## 12. S3 Evolution and floor 2

State: waits for the "before S3" design (section 14). Needs S2 and A1.

### What to build

- After the Warden: the evolution screen. The player chooses Knight or Berserker. The choice changes the stats, adds 1 class skill and 1 passive, and changes the sprite.
- Skill slots: 4. Slot 1 is Slash and cannot change. The class skill goes into a free slot. If no slot is free, the player replaces a skill or declines. A declined skill gives a small upgrade to a held skill.
- Floor 2: the rooms and enemies of floor 1 with a stat multiplier from `data/`, then a stronger Warden. Then a victory screen.

### Acceptance

- [ ] Tests for the evolution, the slot replacement, and the decline upgrade.
- [ ] `npm run balance` covers floor 2 for both classes.
- [ ] JP plays one run as Knight and one as Berserker, and says if they play differently.

## 13. S4 The dungeon remembers

State: waits for the "before S4" design (section 14). Needs S2.

### What to build

- Dead pool in the local save, kept between runs:
  - 3 preset dead heroes on the first launch
  - each dead hero is added with its class, skills, passives, items, curse, and death floor
  - at most 8 of the player's own dead; when the pool is full, a new death replaces the one that died on the shallowest floor
  - presets refill the pool when it has fewer than 3
- Grave room: at most 1 on a floor. Its door shows that it holds a dead hero. The dead hero fights as an enemy, with its own stats and skills.
- After the win: Lay to rest. The player takes one of its items, and the dead hero leaves the pool. (Bind comes after M3.)

### Acceptance

- [ ] Tests for pool add, cap, replacement, and refill.
- [ ] Test: a hero dies in run 1 with a fixed seed. In run 2 its Grave appears, and the fight uses its skills.
- [ ] JP meets his own dead Warrior on his phone.

## 14. Design still pending

This design happens outside Claude Code: JP and Claude work on it in the GDD. The result then goes into this file and into `data/`, and the stage state changes to Ready. Do not start a stage before that.

- **Before S2:** rewards after Fight, Elite, Treasure, and Rest. The item list for M3. Curse numbers. Door rules: how many doors, and the room weights.
- **Before S3:** Knight and Berserker: stats, class skill, passive. Skill upgrades. The floor 2 multiplier and the stronger Warden.
- **Before S4:** AI rules for a dead hero. The 3 preset dead heroes.

## 15. Cut order if time runs out

1. Floor 2. M3 then ends at the evolution choice.
2. The Glass curse. Keep Hunger.
3. Items past a minimum set of 6.
