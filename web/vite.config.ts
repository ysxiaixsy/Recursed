import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The repo root holds data/ and art/, which the game reads from outside web/.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const publicDir = fileURLToPath(new URL('public', import.meta.url));

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(join(dir, e.name)) : [relative(publicDir, join(dir, e.name)).split('\\').join('/')],
  );
}

/**
 * Writes sw.js at build time: a service worker that caches every file of the
 * build, so the game works offline after the first visit (HANDOFF S2: PWA).
 * Pages load from the network first, so a new deploy arrives when online.
 */
function serviceWorker(): Plugin {
  return {
    name: 'recursed-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [...Object.keys(bundle), ...filesIn(publicDir)].filter((f) => !f.endsWith('.map')).sort();
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const urls = ['./', ...files.map((f) => `./${f}`)];
      const source = `// Made by vite.config.ts at build time.
const CACHE = 'recursed-${version}';
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('recursed-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./')));
    return;
  }
  // ignoreVary: the module script asks with an Origin header, and the server's Vary header would make it miss.
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site at https://ysxiaixsy.github.io/Recursed/
  base: '/Recursed/',
  plugins: [serviceWorker()],
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
