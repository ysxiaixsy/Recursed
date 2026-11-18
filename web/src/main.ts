import Phaser from 'phaser';
import { exposeBridge } from './ui/bridge';
import { C } from './ui/palette';
import { GAME_HEIGHT, GAME_WIDTH, keepFitted } from './ui/scale';
import { BattleScene } from './ui/scenes/BattleScene';
import { BootScene } from './ui/scenes/BootScene';
import { PickerScene } from './ui/scenes/PickerScene';
import { RunScene } from './ui/scenes/RunScene';
import { CurseScene, TitleScene } from './ui/scenes/TitleScene';

// Show errors on the page, so a problem on the phone is not a blank screen.
function showError(message: string): void {
  const box = document.createElement('pre');
  box.textContent = `Re: cursed hit an error.\n\n${message}`;
  box.style.cssText = 'position:fixed;inset:0;margin:0;padding:16px;color:#ead4aa;background:#181425;white-space:pre-wrap;font:14px monospace;z-index:9';
  document.body.appendChild(box);
}
window.addEventListener('error', (e) => showError(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason?.stack ?? e.reason)));

const debug = new URLSearchParams(window.location.search).get('debug') === '1';
exposeBridge();

// Offline play after the first visit (HANDOFF S2: PWA). The service worker exists only in a build.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: C.ink,
  pixelArt: true,
  scale: { mode: Phaser.Scale.NONE },
  banner: false,
  disableContextMenu: true,
  scene: [BootScene, TitleScene, CurseScene, RunScene, PickerScene, BattleScene],
  callbacks: {
    preBoot: (game) => game.registry.set('debug', debug),
    postBoot: (game) => keepFitted(game),
  },
});
