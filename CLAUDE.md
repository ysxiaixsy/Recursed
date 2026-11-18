# Recursed

Re: cursed is a turn-based, permadeath, pixel-art dungeon RPG. Mobile first, portrait.

## Where things are

- `HANDOFF.md`: all build instructions and the status of each stage. Start each session there.
- `docs/GDD.md`: the design. It is a snapshot of the live GDD, which JP keeps in a Claude Doc. Do not edit it here.
- `docs/adr/`: decisions. Read `0001-web-stack.md` before any work in `web/`.
- `data/`: all game numbers. Every iteration reads them.
- `tools/sim/reference_sim.py`: the combat rules as code. `tools/sim/expected.json`: the fight results that `web/` must match.
- `art/`: Aseprite sources and PNG exports. `tools/art/`: the Lua scripts that draw them. Art rules: `art-test-brief.md`, `art/REPORT.md`.
- `web/`: the web iteration (TypeScript, Vite, Phaser 4).

## Channel with Claude

- `docs/CHANNEL.md` is the inbox with Claude in claude.ai, which writes the GDD. JP carries messages between the two. Its first section holds the rules.
- At the start of each session, read its Open threads and the newest Log lines. When a stage needs a design fact (HANDOFF rule 8), post the question there as a new thread. End each session with one Log line.

## Rules

- `web/src/core` is plain TypeScript. It imports nothing from Phaser, the DOM, or the browser.
- Game numbers come from `data/`, never from code.
- Combat uses integer math and no randomness. Run generation uses a seeded random generator.
- After a change to a combat rule or to `data/`, run `python tools/sim/reference_sim.py` and report the change in fight length and HP loss. Update `expected.json` only with `--write`, never by hand.
- Before scene code, read the current Phaser 4 docs. Most examples on the web are for Phaser 3.
- One branch and one pull request for each stage in `HANDOFF.md`. JP merges.

## Commands

- `python tools/sim/reference_sim.py`: combat report. Add `--write` to update `tools/sim/expected.json`.
- Art build and checks: see `art/REPORT.md`.
- `web/`: add its commands here when S1 creates it.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `ysxiaixsy/Recursed`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
