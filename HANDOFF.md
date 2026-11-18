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
| S1 First fight | Done: JP tested it on his laptop on 2026-11-18 | Merge PR #1 |
| A0 Second art test | Ready | |
| A1 Art for the slice | Waits for A0 | JP's verdict on A0 |
| S2 One full floor | Ready | PR #1 merged |
| S3 Evolution and floor 2 | Waits for design | S2, A1, and the "before S3" design |
| S4 The dungeon remembers | Waits for design | S2, and the "before S4" design |

Changes from JP on 2026-11-18, which replace older text in this file:

- The base resolution is 360 x 640, scaled by 3 on a 1080 x 1920 screen. S2 makes the change.
- The art tone is now dark and grim. A0 sets the new style before A1.
- Each skill takes two taps (S2).
- The four 2026-11-18 threads in `docs/CHANNEL.md` are answered in this file. Merge the `channel-doc` branch if it is not merged, then tick those threads and add the outcomes to its Decisions table.

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

## 10a. A0 Second art test

JP changed the tone on 2026-11-18. Make a short test in the new style before A1. Use the same process as `art-test-brief.md`: Lua scripts in `tools/art/`, at most 3 rounds for each asset, the automatic checks, and a report in `art/REPORT-A0.md`. Put the A0 files in `art/a0/` (sources and exports), so the M1 art stays as it is until JP decides.

### Style

- Mood: dark and grim, closest to Fear & Hunger. The images in `art/reference/` show the mood and the quality level. They are on JP's computer only, not in git. Copy nothing from them.
- Rooms are dark. The background has real art, but most of it is in shadow. A pool of light shows the fight area.
- Ink-illustration look: dark linework, flat colour fills with 2 to 3 tones, one cold rim light. Light comes from the top left.
- Muted, earthy colours with a few strong accents: blood red, sickly purple, bone.
- Realistic proportions, not stocky.
- No body horror, no gore, no nudity. The threat comes from darkness and mood.
- Heroes face the player.

### What to make

- Base resolution: 360 x 640.
- Warrior: about 112 x 144. Crypt Spider: about 160 x 192. Floor 1 room: 360 x 640.
- One battle mockup at 360 x 640: the room, the Warrior, two Crypt Spiders, and the battle UI (thin light frames on dark panels). Export it at 1x and at 3x (1080 x 1920).
- Make the mockup twice, with two different dark 32-colour palettes. JP picks one.

### Acceptance

- [ ] The automatic checks pass: sizes, palette, hard alpha, exact 3x scale.
- [ ] The report gives the time and the rounds for each asset, what works, and what does not.
- [ ] JP's verdict. Pass: A1 uses the A0 sizes, palette, and rules. Fail: JP and Claude choose another art source before A1.

## 10. A1 Art for the slice

Use the style, palette, and sizes that A0 sets (section 10a), and the automatic checks of `art-test-brief.md`. At most 3 rounds for each asset. The Aseprite path and the build commands are in `art/REPORT.md`.

### What to make

- Font first, because S1 uses a temporary font until then: body text at least 7 pixels tall. Export both fonts as bitmap fonts that Phaser 4 can load, to `art/export/fonts/`.
- Rename `monster` to `crypt_spider`: the source, the exports, and the names in `tools/art`. In the same pull request, remove the `sprite` field of `crypt_spider` in `data/enemies.json`. From then on, a sprite file name is the unit's id.
- Monsters: `bone_guard`, `hollow_acolyte`, `rage_leech`, `grave_rat` (smaller, because it comes in groups of 3), and `the_warden` (the largest). Sizes as A0 sets them.
- Heroes: `knight` and `berserker` at the A0 hero size, made from the A0 Warrior design. Each must read as a Warrior evolution at a glance.
- A portrait of each unit for the turn order row, as in the mockup, in `art/export/portraits/`. Include the Warrior and the Crypt Spider.
- Backgrounds: none. A0 makes the floor 1 room.
- Door icons for the room types, in `art/export/icons/`: fight, elite, rest, treasure, grave, boss.

### Acceptance

- [ ] `tools/art/check` passes for each new asset.
- [ ] One contact sheet PNG with all new sprites on the battle background, at 1x and 4x.
- [ ] JP accepts the look.

## 11. S2 One full floor

State: ready when PR #1 is merged. The design is in section 14 and in `data/`.

### What to build

- First, change the base resolution to 360 x 640, scaled by 3 on a 1080 x 1920 screen. Redo the battle layout for it. Each S1 test must still pass.
- Two taps for each skill. The first tap selects the skill and shows its text. Cleave, Guard, and Warcry fire on a second tap on the same button. Slash fires on a tap on an enemy.
- Title screen. Start screen: Warrior and one curse (Hunger or Glass).
- Floor 1: 5 rooms, then the Warden. Before each room, 2 or 3 doors show their room type.
- Room types: Fight, Elite, Rest, Treasure. (Grave comes in S4.)
- Rewards, items, consumables, skill upgrades, curses, and doors: as in section 14 and `data/`.
- Seeded run: the same seed and the same choices give the same run.
- Save after each player action. A reload restores the exact state, also in the middle of a fight. Closing the browser never undoes a choice. Death deletes the run save.
- Run summary: victory or death, rooms cleared, time, seed.
- PWA: installable, works offline, portrait.
- `npm run balance`: the best-play search from `reference_sim.py`, in TypeScript on top of core. It prints turns and HP loss for each encounter, for slash only and for best play.

### Acceptance

- [ ] Unit tests for seeded room generation, rewards, curses, save, and load.
- [ ] Save test: save in the middle of a fight, load, and finish the fight. The result is the same as with no save.
- [ ] Playwright: a scripted run with a fixed seed reaches the Warden.
- [ ] `npm run balance` also plays 1000 seeded floor 1 runs with two policies, and reports the share that beat the Warden. Policy A: Slash only, the first door, the first reward. Policy B: best play in each fight, and a Rest door when HP is below 50%. First targets: A wins 40% to 70% of runs, B wins 90% or more. If a result is outside its target, report it and ask JP before you tune.
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

## 14. Design

This design happens outside Claude Code: JP and Claude work on it in the GDD. The result then goes into this file and into `data/`, and the stage state changes to Ready. Do not start a stage before that.

### S2 design (done, 2026-11-18)

The numbers are in `data/rooms.json`, `data/items.json`, `data/consumables.json`, `data/curses.json`, and the `upgrade` fields in `data/skills.json`.

- **Rewards.**
  - Fight: choose 1 of 3 rewards. Each is a random item, consumable, or skill upgrade. No two are the same.
  - Elite: the same, but one of the 3 is always a Relic.
  - Treasure: 1 item and 1 consumable, with no fight.
  - Rest: heal 35% of max HP, or upgrade a skill.
- **Items.** Slots: Weapon, Armor, Relic. A new item for a full slot replaces the old one. The player sees both items and can decline the new one.
- **Consumables.** 3 shared slots. Using one is a free action, at most one each turn. When the slots are full, the player replaces one or declines the new one.
- **Skill upgrades.** Each skill can be upgraded once. The `upgrade` field lists the values that change. The skill text changes to the upgrade text.
- **Curses.** Hunger: each kill heals 8% of max HP, and all other healing is halved. Glass: damage dealt x125% (one more multiplier in the damage formula), and max HP x75%.
- **Doors.** 3 doors before each room, drawn with the seeded random generator and the weights in `data/rooms.json`. Use different room types on the doors when possible. No Elite door before room 1. One door before room 5 is always Rest. Grave doors come with S4, at most 1 on each floor.
- **Rounding.** Percents of HP round down. Healing never goes above max HP.
- **No levels and no experience in M3.** The hero grows through items, skill upgrades, and the evolution.

### Still to design

- **Before S3:** Knight and Berserker: stats, class skill, passive. The floor 2 multiplier and the stronger Warden.
- **Before S4:** AI rules for a dead hero. The 3 preset dead heroes.

## 15. Cut order if time runs out

1. Floor 2. M3 then ends at the evolution choice.
2. The Glass curse. Keep Hunger.
3. Items past a minimum set of 6.
