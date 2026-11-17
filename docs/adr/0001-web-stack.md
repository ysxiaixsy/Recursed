# 0001 Web stack for the first iteration

Status: accepted, 2026-11-17

## Context

- The game is mobile first, portrait, 270 x 480 pixel art with whole-number scaling (GDD D23, D27).
- It is turn-based, offline, and keeps saves between runs (D11).
- The art is static sprites with hit effects. There is no physics and no movement.
- JP has two goals: the game must exist, and he wants to learn what Claude and Claude Code can do for a project like this.
- Claude Code must be able to check its own work: run the rules in tests, open the game, and look at it.

## Decision

- **Stack:** TypeScript (strict), Vite, Phaser 4. Vitest for tests. Playwright for browser tests and screenshots.
- **Delivery:** a web app on GitHub Pages, built by GitHub Actions on each push to `main`. It becomes installable (PWA) in the slice. JP tests on his phone with the live URL.
- **Repo layout:** one repo, one folder for each iteration. Each iteration is a complete project with its own dependencies. Iterations never import from each other.

```
docs/    GDD.md, adr/, agents/
art/     shared sprites, palette, fonts
data/    shared numbers (classes, skills, enemies, encounters, rules)
tools/   art scripts, reference combat model (tools/sim)
web/     iteration 1: this stack
```

- **Code split inside `web/`:**
  - `src/core/` is plain TypeScript: rules, state, save data. It imports nothing from Phaser, the DOM, or the browser.
  - `src/ui/` is Phaser: it draws the core state and sends player input to core.

## Alternatives

- **Godot 4.7.** A stronger engine for animation, effects, and native builds, with on-device Android export. Not chosen: the game uses few of these features, each phone test needs an Android build, and screens are mostly made in the editor by hand, so Claude Code can verify less by itself. Choose Godot later if a store release comes soon, or if the game needs much more animation.

## Consequences

- The loop to the phone is short: push, then open the URL.
- Phaser 4 is new (4.0.0 is from April 2026). Most examples on the web are for Phaser 3. Read the current Phaser 4 docs before scene code.
- An app store release needs a wrapper later, for example Capacitor.
- `core/` has no engine code, so a later iteration in another engine can port the rules and reuse `art/` and `data/` as they are.
