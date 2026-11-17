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
console.log(`Built ${out}`);
