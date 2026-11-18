/**
 * A window into the game for the end-to-end tests: window.__recursed. It is
 * read-only state and tap areas; a single-player save is readable anyway. The tests still play with real taps; the bridge tells
 * them where to tap and when the game waits for input.
 */
import type Phaser from 'phaser';
import type { BattleState } from '../core/battle';
import type { RunState } from '../core/run';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bridge {
  scene: string;
  /** Goes up by one each time a screen starts, so a test can wait for the next screen. */
  seq: number;
  /** True when the game waits for a tap: the picker, a hero turn, or the end screen. */
  ready: boolean;
  state: BattleState | null;
  /** The current run, if any. */
  run: RunState | null;
  /** Tap targets in game pixels: 'encounter:<id>', 'skill:<id>', 'enemy:<i>', 'speed', 'again', 'pick'. */
  targets: Record<string, Rect>;
}

export const bridge: Bridge = { scene: '', seq: 0, ready: false, state: null, run: null, targets: {} };

export function exposeBridge(): void {
  (window as unknown as { __recursed: Bridge }).__recursed = bridge;
}

export function resetBridge(scene: string): void {
  bridge.scene = scene;
  bridge.seq += 1;
  bridge.ready = false;
  bridge.state = null;
  bridge.targets = {};
}

/** An invisible tap area. It reacts when the pointer is released over it. */
export function tapZone(scene: Phaser.Scene, id: string, r: Rect, onTap: () => void): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(r.x, r.y, r.w, r.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  zone.on('pointerup', onTap);
  bridge.targets[id] = r;
  return zone;
}
