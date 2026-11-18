# Recursed

Re: cursed is a turn-based, permadeath, pixel-art dungeon RPG. Mobile first, portrait.

## Where things are

- `HANDOFF.md`: all build instructions and the status of each stage. Start each session there.
- `docs/GDD.md`: the design, and the master copy of it since 2026-11-19. Design work happens here with JP: write each change into `docs/GDD.md`, log each decision in its section 13, and then update `HANDOFF.md` and `data/`.
- `docs/adr/`: decisions. Read `0001-web-stack.md` before any work in `web/`.
- `data/`: all game numbers. Every iteration reads them.
- `tools/sim/reference_sim.py`: the combat rules as code. `tools/sim/expected.json`: the fight results that `web/` must match.
- `art/`: Aseprite sources and PNG exports. `tools/art/`: the Lua scripts that draw them. Art rules: `art-test-brief.md`, `art/REPORT.md`.
- `web/`: the web iteration (TypeScript, Vite, Phaser 4).

## Channel with Claude

- `docs/CHANNEL.md` is a record of the old inbox with Claude in claude.ai. It is no longer used: ask JP directly in the session.

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
- `web/` (run inside `web/`; first `npm ci` and `npx playwright install chromium`):
  - `npm test`: unit tests, the parity test with `expected.json`, and the core purity test.
  - `npm run build`: strict type check and build. `tsconfig.core.json` has no DOM types, so a browser API in `src/core` fails here.
  - `npm run e2e`: Playwright at 390 x 844 with touch; screenshots go to `test-results/screenshots/`. It builds and serves on port 4173, but reuses a server already running there: stop an old `vite preview` first, or it tests a stale build.
  - `npm run balance`: each encounter alone, then 1000 seeded floor-1 runs per policy and curse (`npm run balance -- 100` for fewer).
  - The plain URL opens the title screen; `?debug=1` opens the fight picker; `?seed=N` fixes the seed of a new run. `window.__recursed` (tap targets, fight, run) is always there for the e2e tests.
  - `node scripts/make-icons.mjs`: remake the app icons after the Warrior sprite changes.
  - The font is temporary (`node scripts/make-temp-font.mjs`). When A1's fonts land, change `FONT` in `src/ui/text.ts`.
- Pushes to `main` and to stage branches (`s[0-9]-*`) publish https://ysxiaixsy.github.io/Recursed/ (`.github/workflows/web.yml`). The site shows the last published push.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `ysxiaixsy/Recursed`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
