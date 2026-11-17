/**
 * The game area is 270 x 480 pixels. It is shown at the largest whole-number
 * scale that fits the screen, counted in device pixels, so each game pixel is
 * an exact square of device pixels. The rest of the screen shows the page
 * background colour.
 */
import type Phaser from 'phaser';

export const GAME_WIDTH = 270;
export const GAME_HEIGHT = 480;

/** The largest whole-number scale at which the game fits in the given device pixels. */
export function integerScale(deviceWidth: number, deviceHeight: number): number {
  return Math.max(1, Math.floor(Math.min(deviceWidth / GAME_WIDTH, deviceHeight / GAME_HEIGHT)));
}

function fit(game: Phaser.Game): void {
  const canvas = game.canvas;
  const dpr = window.devicePixelRatio || 1;
  const deviceWidth = Math.floor(window.innerWidth * dpr);
  const deviceHeight = Math.floor(window.innerHeight * dpr);
  const scale = integerScale(deviceWidth, deviceHeight);
  const width = GAME_WIDTH * scale;
  const height = GAME_HEIGHT * scale;
  canvas.style.width = `${width / dpr}px`;
  canvas.style.height = `${height / dpr}px`;
  // Whole device pixels for the offset too, so the pixel grid lines up.
  canvas.style.left = `${Math.floor((deviceWidth - width) / 2) / dpr}px`;
  canvas.style.top = `${Math.floor((deviceHeight - height) / 2) / dpr}px`;
  // Phaser reads the new canvas bounds for input mapping.
  game.scale.refresh();
}

export function keepFitted(game: Phaser.Game): void {
  const refit = () => fit(game);
  window.addEventListener('resize', refit);
  window.visualViewport?.addEventListener('resize', refit);
  refit();
}
