# Art Test Report (Milestone M1)

Date: 2026-11-16. Made by Claude Code with Aseprite 1.3.18.6-dev in batch mode.

## Result in short

- All 5 assets exist, and all automatic checks pass.
- The pipeline works: every asset is drawn by a Lua script, and a rebuild gives byte-identical files.
- My opinion of the quality: good enough for a clean, readable pixel RPG. It is **less detailed and
  less gritty than Buriedbornes**. I had no Buriedbornes screenshot in this session, so this
  comparison is from general knowledge. The side-by-side on a phone is the real test, and it is yours.
- If I had to guess your verdict: UI and background are a **Pass**. The character sprites are
  between **Pass** and **Pass with changes**, depending on how close to Buriedbornes detail you need.

## Assets

| # | Asset | Size (px) | Rounds used (max 3) | Time (approx.) | Export |
| --- | --- | --- | --- | --- | --- |
| 1 | Warrior | 64 x 64 | 3 | 4 min | `export/warrior.png` |
| 2 | Monster (crypt spider) | 80 x 80 | 3 | 4 min | `export/monster.png` |
| 3 | Battle background | 270 x 480 | 2 | 4 min | `export/background.png` |
| 4 | UI kit | 270 x 172 | 2 | 5 min | `export/ui_kit.png` |
| 5 | Battle mockup | 270 x 480 | 1 | 2 min | `export/battle_mockup.png` |

- Every asset also has a 4x export in `export/4x/` and a source file in `src/`.
- The file for your verdict is `export/4x/battle_mockup.png` (1080 x 1920).
- Shared work (reading the Aseprite docs, the drawing library, the check script, verification) took
  about 5 more minutes. Total: about 23 minutes of wall-clock time.
- Times are approximate. They come from timestamps logged at each first build, and the rounds of
  different assets overlapped.
- A "round" is one cycle of: look at the export, compare with the checklist, change the script, build again.
  The first build is not counted as a round.

## How to build and check

```
# Git Bash
ASEPRITE="C:/Users/JP/Documents/GitHub/aseprite/build/bin/aseprite.exe" tools/art/build
ASEPRITE="C:/Users/JP/Documents/GitHub/aseprite/build/bin/aseprite.exe" tools/art/check

# PowerShell
$env:ASEPRITE = "C:\Users\JP\Documents\GitHub\aseprite\build\bin\aseprite.exe"
tools\art\build.ps1
tools\art\check.ps1
```

- `build` with no arguments builds all five assets in order. `build warrior` builds one.
- The UI kit and the mockup read the sprite exports, so build `warrior` and `monster` first.
- Set `PREVIEW_DIR` to a folder to also get enlarged previews (sprite beside its silhouette).

## Automatic checks

`tools/art/check` passes all 41 checks. It tests, for each asset:

- exact size, indexed colour mode, alpha 0 or 255 only, every pixel is a palette colour;
- sprites 1 and 2: transparent background, 1 pixel of empty margin, and (an extra check) every
  edge pixel is the outline colour;
- the 4x export is an exact nearest-neighbour scale of the 1x export;
- the `.aseprite` source is indexed, the same size, and has one frame;
- total colours across all assets: 30 of the 32 in the palette.

I also tested the check itself: on tampered copies (an off-palette pixel, a half-transparent pixel,
one changed pixel in a 4x file, a wrong size) it reported each fault and returned exit code 1.

## Visual checklist (my view; you decide)

| Item | My view |
| --- | --- |
| Silhouette readable in one colour | Warrior: yes, sword, helmet, and shield are clear. Spider: yes, raised front legs and wide leg fan. The Warrior's cape makes the hip area less clean than before the cape. |
| Warrior and monster readable at 1x on the background | Yes. The Warrior is the brightest thing on the floor. The spiders are darker; their red eyes, red mark, and pale claws carry them. Their shadow-side legs are close in value to the floor. |
| Light direction and outline rule the same everywhere | Yes. One light vector in the library shades every sprite and icon. Wall blocks, floor tiles, pillars, and UI frames are lit on top and left. All sprites and icons have a 1-pixel outline in the darkest colour. |
| UI text and icons readable at 1x | Text: yes, but it is the minimum size (5 pixels tall). Icons: sword, axe, shield, and potions read well. The WARCRY flame is hidden by the cooldown state in this mockup. |
| The 5 assets look like one game | Yes. This is the strongest result. One palette, one light, one outline rule, and portraits cut from the real sprites. |

## What worked

- **Shapes instead of single pixels.** The library draws each body part as a shape (ellipse, capsule,
  polygon), shades it from one light, then adds separation lines, drop shadows, and the outline.
  Hand-placed pixels are used only for small details (visor, eyes, rivets). The first Warrior build
  was already usable.
- **One palette with named ramps.** Endesga 32, unchanged. Steel, leather, red, gold, and purple
  ramps kept colours consistent without effort.
- **Shared widget code.** The UI kit sheet and the mockup call the same functions, so they cannot differ.
- **Looking at every export.** Most fixes came from viewing the image: a spotlight look on the floor,
  torch glow that was too large, an axe icon that read as a pickaxe, a "W" that read as "H".
- **Self-checking exports.** One save failed once without an error code (the file was locked for a
  moment). The export function now reads the PNG back and stops if it differs.

## What did not work, or is weak

- **Detail density.** Shapes shaded by a formula look clean and a little rounded, like clay. Buriedbornes
  has rougher, denser, more hand-made detail. More detail is possible, but each detail is a line of code
  with coordinates, so cost grows fast.
- **Proportions.** The Warrior is stocky (large helmet, short legs). This reads well at 64 px, but it is
  more "cute" than "grim". Realistic proportions at 64 px would make the head about 9 pixels wide.
- **Round limit reached on both sprites.** The cape (round 2) added mood but made the Warrior's
  silhouette less clean. Round 3 only narrowed it. With more rounds I would test a version without it.
- **Spider on a dark floor.** Purple on dark blue is a low-contrast pair. It passes because of the
  accents, not because of the body colour.
- **Background floor is plain.** It is calm on purpose, but large areas have little to look at.
- **Dither bands.** The light falloff on the wall and floor uses ordered dither. At 4x some areas look noisy.
- **Not tested:** animation (excluded by the brief), other classes, other monster shapes, other floors.
  A new sprite needs a new script with hand-tuned coordinates. The spider took about as long as the Warrior.

## Choices I made where the brief was open

- Palette: Endesga 32 with no changes. Palette index 0 is transparent and is not one of the 32 colours.
- Monster: a spider in a threat pose, so its shape is wide and spiky, unlike the upright Warrior.
- UI kit size: 270 x 172. It has three layers in the source file: backdrop, widgets, labels.
  Each widget is a named slice; the `panel` slice has its 9-slice centre set.
- Font: a 5-pixel bitmap font drawn by the scripts. No font file, no licence question.
- Check script: Lua run by Aseprite (`check.lua`), with `check` and `check.ps1` wrappers. No other installs.
- Mockup extras that are not in the deliverables list: enemy health bars, a target cursor, a "FLOOR 1"
  label, a skill description strip, and ground shadows under the sprites.
- Skill names, numbers, and item types in the UI are placeholders.

## Files

```
art/palette.hex            32 colours (Endesga 32)
art/src/*.aseprite         5 source files
art/export/*.png           5 exports at 1x
art/export/4x/*.png        5 exports at 4x
tools/art/lib/core.lua     canvas, shapes, lighting, outline, export
tools/art/lib/font.lua     bitmap font
tools/art/lib/ui.lua       UI widgets and icons
tools/art/<asset>.lua      one script per asset
tools/art/check.lua        automatic checks
tools/art/build, check     wrappers (also .ps1)
```
