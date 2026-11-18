/**
 * Art from art/export/, found at build time. A unit's sprite is
 * art/export/<name>.png and its portrait is art/export/portraits/<name>.png,
 * where <name> is the unit's sprite field in data/, or its id. A file that
 * does not exist yet gives no texture, and the ui draws a placeholder.
 */
import Phaser from 'phaser';

const files = import.meta.glob<string>(
  ['../../../art/export/*.png', '../../../art/export/portraits/*.png', '!../../../art/export/battle_mockup.png'],
  { eager: true, query: '?url', import: 'default' },
);

/** Art paths without the folder and extension, e.g. 'warrior' or 'portraits/warrior', and their URLs. */
const art = new Map<string, string>(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/art\/export\//, '').replace(/\.png$/, ''), url]),
);

const key = (path: string) => `art:${path}`;

export function loadArt(scene: Phaser.Scene): void {
  for (const [path, url] of art) scene.load.image(key(path), url);
}

export function spriteName(def: { id: string; sprite: string | null }): string {
  return def.sprite ?? def.id;
}

/** The texture key of a unit's sprite, or null if the file does not exist. */
export function spriteKey(name: string): string | null {
  return art.has(name) ? key(name) : null;
}

/** The texture key of a unit's portrait, or null if the file does not exist. */
export function portraitKey(name: string): string | null {
  return art.has(`portraits/${name}`) ? key(`portraits/${name}`) : null;
}

export const BACKGROUND = 'background';

export function backgroundKey(): string | null {
  return spriteKey(BACKGROUND);
}

/**
 * Skill icons, cut from the UI kit sheet (art/export/ui_kit.png, drawn by
 * tools/art/ui_kit.lua): the 24 x 24 icon in each skill button of the sheet.
 * Warcry has no clean icon there (the sheet shows it under the cooldown mark).
 */
const KIT = { path: 'ui_kit', width: 270, height: 172 } as const;
const KIT_ICONS: Readonly<Record<string, readonly [number, number]>> = {
  slash: [13, 57],
  cleave: [77, 57],
  guard: [141, 57],
};
const ICON_SIZE = 24;

/** Add the icon frames to the kit texture. Call once after loading. */
export function addKitFrames(scene: Phaser.Scene): void {
  const k = key(KIT.path);
  if (!scene.textures.exists(k)) return;
  const texture = scene.textures.get(k);
  const source = texture.getSourceImage() as { width: number; height: number };
  // Cut only from the sheet layout these positions were measured on.
  if (source.width !== KIT.width || source.height !== KIT.height) return;
  for (const [skill, [x, y]] of Object.entries(KIT_ICONS)) texture.add(`icon:${skill}`, 0, x, y, ICON_SIZE, ICON_SIZE);
}

/** [texture, frame] of a skill icon, or null if there is none. */
export function skillIcon(scene: Phaser.Scene, skillId: string): [string, string] | null {
  const k = key(KIT.path);
  return scene.textures.exists(k) && scene.textures.get(k).has(`icon:${skillId}`) ? [k, `icon:${skillId}`] : null;
}
