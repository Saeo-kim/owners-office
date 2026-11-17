// Builds the static "browser mode" site into dist/ for GitHub Pages:
// public/ + src/core/ + the sql.js WebAssembly build, with the mode meta switched.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const require = createRequire(import.meta.url);
const sqlDist = dirname(require.resolve('sql.js/dist/sql-wasm.js'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'public'), out, { recursive: true });
cpSync(join(root, 'src/core'), join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'vendor'), { recursive: true });
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) cpSync(join(sqlDist, f), join(out, 'vendor', f));
cpSync(join(sqlDist, '..', 'LICENSE'), join(out, 'vendor', 'SQLJS-LICENSE'));

const indexPath = join(out, 'index.html');
const html = readFileSync(indexPath, 'utf8').replace('<meta name="oo-mode" content="server">', '<meta name="oo-mode" content="browser">');
if (!html.includes('content="browser"')) throw new Error('mode meta not found in index.html');
writeFileSync(indexPath, html);
writeFileSync(join(out, '.nojekyll'), '');
if (!existsSync(join(out, 'core', 'api.js'))) throw new Error('core not copied');

// Service worker: give every build its own cache name so old shells are dropped.
const swPath = join(out, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
if (!sw.includes('__BUILD_ID__')) throw new Error('build id placeholder not found in sw.js');
const buildId = (process.env.GITHUB_SHA ?? '').slice(0, 12) || `local-${Date.now().toString(36)}`;
writeFileSync(swPath, sw.replaceAll('__BUILD_ID__', buildId));

// PWA files that must ship for install and offline use.
for (const f of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'sw.js']) {
  if (!existsSync(join(out, f))) throw new Error(`PWA file missing from build: ${f}`);
}
console.log(`Built ${out}`);
