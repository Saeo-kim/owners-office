// Static checks for the installable (PWA) app: manifest, icons, iPhone meta
// tags, and the service worker's precache list. Browser-level checks live in
// tests/e2e/pwa.js.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const read = (p) => readFileSync(join(pub, p), 'utf8');

// Reads width/height from a PNG's IHDR chunk.
function pngSize(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', `${path} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('manifest is valid and installable', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.ok(m.name && m.short_name, 'name and short_name required');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'needs 192 and 512 icons');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'needs a maskable icon');
  for (const icon of m.icons) {
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(join(pub, icon.src));
    assert.deepEqual(actual, { width: w, height: h }, `${icon.src} size mismatch`);
  }
});

test('iPhone apple-touch-icon is a 180px square PNG', () => {
  assert.deepEqual(pngSize(join(pub, 'icons/apple-touch-icon.png')), { width: 180, height: 180 });
});

test('index.html has the PWA and iOS home-screen tags', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="[^"]+">/);
  assert.match(html, /viewport-fit=cover/);
});

test('service worker precache list points at existing files', () => {
  const sw = read('sw.js');
  assert.match(sw, /__BUILD_ID__/, 'build placeholder must exist for build-pages.js');
  const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, 'SHELL list not found');
  const files = [...block[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(files.length >= 8, 'shell list looks too short');
  for (const f of files) assert.ok(existsSync(join(pub, f)), `precache entry missing: ${f}`);
});

test('service worker never caches the local API', () => {
  assert.match(read('sw.js'), /includes\('\/api\/'\)\) return;/);
});

test('main.js registers the service worker only in secure contexts', () => {
  const main = read('js/main.js');
  assert.match(main, /'serviceWorker' in navigator && window\.isSecureContext/);
  assert.match(main, /register\('sw\.js'\)/);
});
