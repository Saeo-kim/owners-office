// Browser end-to-end check using the DevTools protocol of an installed
// Chrome/Edge (no extra packages). Not part of `npm test`; run with
//   npm run test:e2e            (starts its own server on a temp database)
//   E2E_URL=https://... npm run test:e2e   (checks an already deployed site)
// It visits every screen at desktop and phone width, fails on console errors
// or horizontal overflow, then creates/edits/deletes a record through the UI.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = BROWSERS.find((p) => existsSync(p));
if (!browserPath) {
  console.error('No Chrome/Edge found. Set BROWSER=/path/to/chrome');
  process.exit(2);
}
const shotDir = process.env.E2E_SHOTS;
const tmp = mkdtempSync(join(tmpdir(), 'oo-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};

async function startServer() {
  const port = 4390 + Math.floor(Math.random() * 100);
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), OFFICE_DB: join(tmp, 'e2e.db') },
    stdio: 'pipe',
  });
  procs.push(p);
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) return `http://localhost:${port}/`;
    } catch {}
    await sleep(100);
  }
  throw new Error('server did not start');
}

// Serves dist/ (the GitHub Pages build) under a sub-path, like Pages does.
async function startStatic() {
  const { createServer } = await import('node:http');
  const { readFileSync, statSync } = await import('node:fs');
  const dist = join(root, 'dist');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/owners-office/, '');
    if (p.endsWith('/')) p += 'index.html';
    const file = join(dist, p);
    try {
      if (!file.startsWith(dist) || !statSync(file).isFile()) throw new Error();
      res.writeHead(200, { 'Content-Type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  procs.push({ kill: () => server.close() });
  return `http://127.0.0.1:${server.address().port}/owners-office/`;
}

async function startBrowser() {
  const port = 9300 + Math.floor(Math.random() * 300);
  const p = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmp, 'profile')}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  procs.push(p);
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('browser did not start');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
    } else listeners.forEach((l) => l(msg));
  };
  return new Promise((ok) => {
    ws.onopen = () => ok({
      send: (method, params = {}) => new Promise((res, rej) => {
        pending.set(++id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      on: (fn) => listeners.push(fn),
      close: () => ws.close(),
    });
  });
}

async function main() {
  const base = process.env.E2E_URL ?? ((process.env.E2E_DIST || process.argv.includes('--dist')) ? await startStatic() : await startServer());
  const cdp = await connect(await startBrowser());
  const errors = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  const evaluate = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  const waitFor = async (expr, ms = 15000) => {
    for (let t = 0; t < ms; t += 100) {
      if (await evaluate(expr)) return true;
      await sleep(100);
    }
    return false;
  };
  const shot = async (name) => {
    if (!shotDir) return;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(shotDir, `${name}.png`), Buffer.from(data, 'base64'));
  };
  const loaded = `!!document.querySelector('main .kpis, main .tabs, main .card, main .empty') && !document.querySelector('main .loading')`;

  await cdp.send('Page.navigate', { url: `${base}#/dashboard` });
  check(await waitFor(loaded, 30000), 'app loads');
  const screens = ['dashboard', 'finance/transactions', 'finance/cashflow', 'finance/ventures', 'finance/accounts', 'finance/targets', 'employees', 'ventures', 'goals', 'productivity', 'audit', 'settings'];
  for (const [label, width, height, mobile] of [['desktop', 1440, 1000, false], ['phone', 375, 800, true]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    for (const s of screens) {
      await evaluate(`location.hash = '#/${s}'`);
      await sleep(150);
      const ok = await waitFor(`${loaded} && !document.querySelector('main').textContent.includes('불러오지 못했습니다')`);
      const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      check(ok && overflow <= 1, `${label} ${s} renders${overflow > 1 ? ` (overflows by ${overflow}px)` : ''}`);
      await shot(`${label}-${s.replace('/', '-')}`);
    }
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  // Create a real transaction through the form, then edit and delete it.
  await evaluate(`location.hash = '#/finance/transactions'`);
  await waitFor(loaded);
  await evaluate(`document.querySelector('[data-new="transactions"]').click()`);
  check(await waitFor(`document.getElementById('dialog').open`), 'form opens');
  await evaluate(`(() => {
    const f = document.querySelector('#dialog form');
    f.elements.direction.value = 'income'; f.dispatchEvent(new Event('change', { bubbles: true }));
    f.elements.amount.value = '1,234,567'; f.elements.income_type.value = 'business_revenue';
    f.elements.description.value = 'E2E 매출';
    f.querySelector('[type=submit]').click();
  })()`);
  check(await waitFor(`!document.getElementById('dialog').open && document.querySelector('main').textContent.includes('E2E 매출')`), 'create via form');
  check(await evaluate(`!document.querySelector('main tr:has(td) .demo') || [...document.querySelectorAll('main tr')].some(r => r.textContent.includes('E2E 매출') && !r.querySelector('.demo'))`), 'new record is not marked DEMO');
  await evaluate('location.reload()');
  await sleep(500);
  check(await waitFor(`${loaded} && document.querySelector('main').textContent.includes('E2E 매출')`, 30000), 'record survives a page reload');
  await evaluate(`[...document.querySelectorAll('main tr')].find(r => r.textContent.includes('E2E 매출')).querySelector('[data-edit]').click()`);
  await waitFor(`document.getElementById('dialog').open && document.querySelector('#dialog [name=amount]')?.value === '1,234,567'`);
  await evaluate(`(() => { const f = document.querySelector('#dialog form'); f.elements.description.value = 'E2E 매출 수정'; f.querySelector('[type=submit]').click(); })()`);
  check(await waitFor(`document.querySelector('main').textContent.includes('E2E 매출 수정')`), 'edit via form');
  await evaluate(`[...document.querySelectorAll('main tr')].find(r => r.textContent.includes('E2E 매출 수정')).querySelector('[data-delete]').click()`);
  await waitFor(`document.getElementById('dialog').open`);
  await evaluate(`document.querySelector('#dialog button[value=ok]').click()`);
  check(await waitFor(`!document.querySelector('main').textContent.includes('E2E 매출 수정')`), 'delete via confirm dialog');

  // Validation errors are shown in the form.
  await evaluate(`document.querySelector('[data-new="transactions"]').click()`);
  await waitFor(`document.getElementById('dialog').open`);
  await evaluate(`(() => { const f = document.querySelector('#dialog form'); f.elements.amount.value = ''; f.querySelector('[type=submit]').click(); })()`);
  check(await waitFor(`!!document.querySelector('#dialog .field.invalid')`), 'validation errors shown in form');
  await evaluate(`document.querySelector('#dialog [data-close]').click()`);

  // Demo data can be removed in one step and real data survives.
  await evaluate(`location.hash = '#/settings'`);
  await waitFor(loaded);
  await evaluate(`document.querySelector('[data-action="delete-demo"]').click()`);
  await waitFor(`document.getElementById('dialog').open`);
  await evaluate(`document.querySelector('#dialog button[value=ok]').click()`);
  check(await waitFor(`document.getElementById('demo-banner').hidden`), 'demo data deleted, banner hidden');
  await evaluate(`location.hash = '#/dashboard'`);
  check(await waitFor(`${loaded} && document.querySelector('main').textContent.includes('데이터 없음')`), 'empty dashboard shows "데이터 없음" instead of estimates');

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  cdp.close();
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(async () => {
    for (const p of procs) p.kill();
    await sleep(500);
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
    console.log(failures ? `\n${failures} failure(s)` : '\nAll browser checks passed');
    process.exit(failures ? 1 : 0);
  });
