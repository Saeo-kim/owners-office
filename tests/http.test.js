// End-to-end over real HTTP, plus parity between node:sqlite and sql.js.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { request } from 'node:http';
import { createHttpServer } from '../server/app.js';
import { createApi } from '../src/core/api.js';
import { createRepository } from '../src/core/repository.js';
import { migrate } from '../src/core/schema.js';
import { wrapSqlJs } from '../src/core/sqljs-adapter.js';
import { NOW, setup } from './helpers.js';

let server;
let port;

before(async () => {
  const { api } = setup();
  server = createHttpServer(api);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.close());

function http(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = request({ host: '127.0.0.1', port, method, path, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('CRUD over HTTP', async () => {
  const c = await http('POST', '/api/worklogs', { date: '2026-11-17', task: '테스트', category: 'build', minutes: 30 });
  assert.equal(c.status, 201);
  assert.equal((await http('PUT', `/api/worklogs/${c.json.id}`, { minutes: 45 })).json.minutes, 45);
  assert.equal((await http('GET', '/api/worklogs')).json.length, 1);
  assert.equal((await http('DELETE', `/api/worklogs/${c.json.id}`)).status, 200);
  const bad = await http('POST', '/api/worklogs', { task: '' });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.errors.task);
});

test('request guards', async () => {
  assert.equal((await http('POST', '/api/accounts', 'x', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await http('POST', '/api/accounts', '{bad', {})).status, 400);
  assert.equal((await http('GET', '/api/health', undefined, { Host: 'evil.example.com' })).status, 403);
  assert.equal((await http('GET', '/../package.json')).status, 404);
});

test('serves the app shell and shared core modules', async () => {
  const index = await http('GET', '/');
  assert.equal(index.status, 200);
  assert.match(index.text, /OWNER'S OFFICE/);
  assert.match(index.headers['content-security-policy'], /default-src 'self'/);
  const core = await http('GET', '/core/enums.js');
  assert.equal(core.status, 200);
  assert.match(core.headers['content-type'], /javascript/);
  assert.equal((await http('GET', '/js/views/dashboard.js')).status, 200);
});

test('every analysis endpoint answers', async () => {
  await http('POST', '/api/demo');
  for (const name of ['dashboard', 'finance', 'employees', 'ventures', 'goals', 'productivity', 'audit']) {
    const r = await http('GET', `/api/analysis/${name}`);
    assert.equal(r.status, 200, name);
  }
});

test('sql.js (browser mode) gives the same results as node:sqlite', async () => {
  const require = createRequire(import.meta.url);
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = wrapSqlJs(new SQL.Database());
  migrate(db);
  const browser = createApi({ repo: createRepository(db), now: () => NOW });
  const node = setup().api;
  for (const api of [browser, node]) assert.equal(api.handle({ method: 'POST', path: '/api/demo' }).status, 200);
  for (const name of ['dashboard', 'finance', 'employees', 'ventures', 'goals', 'productivity', 'audit']) {
    const a = browser.handle({ path: `/api/analysis/${name}` });
    const b = node.handle({ path: `/api/analysis/${name}` });
    assert.equal(a.status, 200);
    // Row timestamps come from each engine's clock, so compare everything else.
    const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'created_at' || k === 'updated_at' ? undefined : v)));
    assert.deepEqual(strip(a.body), strip(b.body), name);
  }
  // Persisted bytes reopen with the same data.
  const reopened = createRepository(wrapSqlJs(new SQL.Database(db.export())));
  assert.equal(reopened.list('transactions').length, node.handle({ path: '/api/transactions' }).body.length);
});
