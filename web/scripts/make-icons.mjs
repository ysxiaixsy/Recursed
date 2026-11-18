// Makes the app icons for the install (PWA): the Warrior sprite, scaled by
// whole numbers with hard pixels, on the ink background. Run from web/ after
// the Warrior sprite changes:  node scripts/make-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SPRITE = '../art/export/warrior.png';
const OUT = 'public/icons';
const INK = '#181425';
const SIZES = [192, 512];

const png = readFileSync(SPRITE).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const data = await page.evaluate(
    async ({ png, size, ink }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, size, size);
      // The largest whole-number scale that leaves a margin (the safe zone of maskable icons).
      const scale = Math.floor((size * 0.8) / Math.max(img.width, img.height));
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { png, size, ink: INK },
  );
  writeFileSync(`${OUT}/icon-${size}.png`, Buffer.from(data, 'base64'));
  console.log(`${OUT}/icon-${size}.png`);
}
await browser.close();
