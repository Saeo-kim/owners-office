// Tests for the Cloudflare Durable Object code path. A fake ctx with the same
// shape as Durable Object storage (ctx.storage.sql + transactionSync) is backed
// by node:sqlite, so the real migrations, repository and API run unchanged.
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitStatements } from '../src/worker/sql-adapter.js';
import { createOffice, runApiRequest } from '../src/worker/office.js';
import { authorize } from '../src/worker/auth.js';

function fakeCtx() {
  const raw = new DatabaseSync(':memory:');
  const sql = {
    exec(text, ...params) {
      const reads = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(text);
      const st = raw.prepare(text);
      const rows = reads ? st.all(...params) : (st.run(...params), []);
      return { toArray: () => rows, one: () => rows[0] };
    },
  };
  return {
    storage: {
      sql,
      transactionSync(fn) {
        raw.exec('BEGIN');
        try {
          const result = fn();
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          raw.exec('ROLLBACK');
          throw err;
        }
      },
    },
  };
}

test('splitStatements respects strings and comments', () => {
  const parts = splitStatements("CREATE TABLE a (x TEXT DEFAULT 'a;b'); -- it's; a comment\nINSERT INTO a VALUES ('c'); ");
  assert.equal(parts.length, 2);
  assert.match(parts[0], /'a;b'/);
  assert.match(parts[1], /INSERT/);
});

test('office migrates, saves a settings change, and reads it back', () => {
  const office = createOffice(fakeCtx());
  const put = runApiRequest(office, { method: 'PUT', path: '/api/settings', body: { max_active_ventures: 7 } });
  assert.equal(put.status, 200);
  const status = runApiRequest(office, { method: 'GET', path: '/api/status' });
  assert.equal(status.status, 200);
  assert.equal(status.body.mode, 'cloud');
  assert.equal(status.body.settings.max_active_ventures, 7);
});

test('a failed request leaves no partial writes behind', () => {
  const office = createOffice(fakeCtx());
  runApiRequest(office, { method: 'PUT', path: '/api/settings', body: { max_active_ventures: 5 } });
  const bad = runApiRequest(office, { method: 'PUT', path: '/api/settings', body: { max_active_ventures: 'not-a-number' } });
  assert.ok(bad.status >= 400, 'invalid input must be rejected');
  const status = runApiRequest(office, { method: 'GET', path: '/api/status' });
  assert.equal(status.body.settings.max_active_ventures, 5);
});

test('data written in one office instance is still there after reopening the same storage', () => {
  const ctx = fakeCtx();
  runApiRequest(createOffice(ctx), { method: 'PUT', path: '/api/settings', body: { max_active_ventures: 9 } });
  const reopened = createOffice(ctx);
  const status = runApiRequest(reopened, { method: 'GET', path: '/api/status' });
  assert.equal(status.body.settings.max_active_ventures, 9);
});

test('passcode gate fails closed without a secret and checks Basic auth', () => {
  const req = (auth) => new Request('https://example.test/', auth ? { headers: { Authorization: auth } } : {});
  assert.equal(authorize(req(null), {}).status, 503);
  assert.equal(authorize(req(null), { OWNER_PASSCODE: 'secret' }).status, 401);
  assert.equal(authorize(req('Basic ' + btoa('owner:wrong')), { OWNER_PASSCODE: 'secret' }).status, 401);
  assert.equal(authorize(req('Basic ' + btoa('owner:secret')), { OWNER_PASSCODE: 'secret' }), null);
});
