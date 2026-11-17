# Re: cursed — Art Test Brief (Milestone M1)

## Goal

Prove that Claude Code with Aseprite scripts can make pixel art good enough to ship Re: cursed.
The result decides the art style for the full game. This is a test, not production art.

Reference for the quality level: Buriedbornes (dark fantasy, detailed pixel art).
Use it as a quality bar only. Do not trace, copy, or imitate specific Buriedbornes sprites.

## Fixed constraints

- Screen: 270 x 480 pixels, portrait. Exports scale by whole numbers only (nearest neighbour).
- One fixed palette for all assets, at most 32 colours. Suggested start: Endesga 32 or Resurrect 64
  (reduced to 32) from Lospec. Record the final palette in `art/palette.hex`.
- Indexed colour mode. Alpha is fully transparent or fully opaque. No soft edges, no gradients made with alpha.
- Light comes from the top left on every asset.
- Characters and monsters have a dark outline, 1 pixel wide.
- Static sprites only. No animation in this test.

## Deliverables

| # | Asset | Size (px) | Notes |
| --- | --- | --- | --- |
| 1 | Warrior (hero) | 64 x 64 | Base class, front view, idle pose. The same sprite is used for allies and for dead characters as enemies. |
| 2 | Monster | 80 x 80 | One dungeon enemy for floor 1. Must read clearly as hostile and as a different shape from the Warrior. |
| 3 | Battle background | 270 x 480 | Floor 1 dungeon. Enemies stand in the upper half, the party in the lower half. Keep those areas calm so sprites stay readable. |
| 4 | UI kit | fits 270 wide | Turn bar with 4 portrait markers, 4 skill buttons, HP bar, archetype resource bar (Rage), 3 consumable slots, speed button (1x/2x/3x), one 9-slice panel. |
| 5 | Battle mockup | 270 x 480 | One composite image: background + 1 Warrior + 2 monsters + full UI. Export at 1x and at 4x (1080 x 1920). |

The mockup layout (enemies on top, party below, skills at the bottom) is for this test only.
The final battle layout is not decided.

## Folder layout

```
art/
  palette.hex
  src/        .aseprite source files
  export/     PNG exports (1x) and export/4x/
tools/art/    Lua scripts for Aseprite, one per asset, plus a check script
```

## Process rules

1. Make every asset with Aseprite in batch mode, driven by Lua scripts. Read the current Aseprite CLI
   and scripting API documentation first; do not guess function names.
2. Each script must run again and give the same result.
3. After each export, open the PNG and look at it. Compare it with the checklist below. Fix and run again.
4. Limit: 3 improvement rounds for each asset. Stop there and report, even if the result is weak.
   A weak result is useful information.
5. Write `art/REPORT.md`: what worked, what did not, time and number of rounds for each asset,
   and an honest opinion of the quality.

## Automatic checks (script: `tools/art/check`)

Each export must pass all of these:

- Exact size as in the table.
- Every pixel uses a palette colour. Total colours across all assets: 32 or fewer.
- Alpha is 0 or 255 only.
- Sprites 1 and 2 have a transparent background and at least 1 pixel of empty margin.
- The 4x export is an exact nearest-neighbour scale of the 1x export.

## Visual checklist (Claude Code checks, then JP decides)

- The silhouette of each sprite is readable when filled with one colour.
- The Warrior and the monster are readable at 1x on the busy background.
- Light direction and outline rule are the same on all assets.
- UI text and icons are readable at 1x.
- The 5 assets look like one game.

## Verdict (JP decides)

JP opens `export/4x/battle_mockup.png` on a phone, next to a Buriedbornes screenshot.

| Verdict | Meaning | Next step |
| --- | --- | --- |
| Pass | Good enough to ship at this level of detail | Lock the palette, sizes, and style rules in the GDD |
| Pass with changes | The pipeline works, but only at lower detail | Simplify the style (fewer colours or smaller sprites) and run one more test |
| Fail | The pipeline cannot reach an acceptable look | Change the art source: asset packs, hand-drawn sprites, or a mixed method |
