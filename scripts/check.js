// Syntax-checks every JavaScript file and verifies that each relative import resolves.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
};
for (const d of ['server', 'src', 'public/js', 'scripts', 'tests']) walk(join(root, d));

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`SYNTAX ${f}\n${err.stderr}`);
  }
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:import|from)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    let target = resolve(dirname(f), m[1]);
    // public/js/** imports '../core/x.js', which the server and the Pages build map to src/core.
    if (!existsSync(target) && f.includes(`${join('public', 'js')}`)) target = target.replace(join(root, 'public', 'core'), join(root, 'src', 'core'));
    if (!existsSync(target)) {
      failed++;
      console.error(`IMPORT ${f}: ${m[1]}`);
    }
  }
}
console.log(`${files.length} files checked, ${failed} problem(s).`);
process.exit(failed ? 1 : 0);
