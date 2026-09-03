import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8')) as {
  id?: string;
  scope?: string;
  start_url?: string;
  display?: string;
  icons?: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const prompt = readFileSync(new URL('../components/PwaInstallPrompt.tsx', import.meta.url), 'utf8');

function pngDimensions(relativeUrl: string) {
  const bytes = readFileSync(new URL(relativeUrl, import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('PWA manifest has a stable scope, standalone start and real square raster icons', () => {
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/dashboard');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons?.some((icon) => icon.src === '/seepoint-app-icon-192.png' && icon.sizes === '192x192'));
  assert.ok(manifest.icons?.some((icon) => icon.src === '/seepoint-app-icon-512.png' && icon.sizes === '512x512'));
  assert.deepEqual(pngDimensions('../public/seepoint-app-icon-192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions('../public/seepoint-app-icon-512.png'), { width: 512, height: 512 });
});

test('service worker caches only a public offline shell and never authenticated pages or APIs', () => {
  assert.match(serviceWorker, /PRECACHE_URLS/);
  assert.match(serviceWorker, /request\.mode !== 'navigate'/);
  assert.match(serviceWorker, /fetch\(request\)\.catch/);
  assert.doesNotMatch(serviceWorker, /\/api\//);
  assert.doesNotMatch(serviceWorker, /\/dashboard/);
});

test('PWA technical files bypass auth middleware while application routes stay protected', () => {
  for (const file of ['manifest.json', 'sw.js', 'offline.html', 'seepoint-app-icon-192.png', 'seepoint-app-icon-512.png']) {
    assert.match(middleware, new RegExp(file.replace('.', '\\.')));
  }
  assert.doesNotMatch(middleware, /dashboard/);
});

test('install UI handles app installation, dismissal, offline state and accessible zoom', () => {
  assert.match(prompt, /appinstalled/);
  assert.match(prompt, /INSTALL_PROMPT_COOLDOWN_MS/);
  assert.match(prompt, /window\.navigator\.onLine/);
  assert.match(prompt, /role="status"/);
  assert.doesNotMatch(layout, /userScalable:\s*false/);
  assert.doesNotMatch(layout, /maximumScale:\s*1/);
});
