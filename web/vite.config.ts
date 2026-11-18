import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The repo root holds data/ and art/, which the game reads from outside web/.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  // GitHub Pages serves the site at https://ysxiaixsy.github.io/Recursed/
  base: '/Recursed/',
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    target: 'es2022',
    // Keep every image a separate file, so Phaser loads plain URLs.
    assetsInlineLimit: 0,
    // Phaser alone is about 1.3 MB minified.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
