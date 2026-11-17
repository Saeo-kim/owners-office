// Tests for the Cloudflare Durable Object code path. A fake ctx with the same
// shape as Durable Object storage (ctx.storage.sql + transactionSync) is backed
// by node:sqlite, so the real migrations, repository and API run unchanged.
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitStatements } from '../src/worker/sql-adapter.js';
import { createOffice, runApiRequest } from '../src/worker/office.js';
import { checkPasscode, isAuthenticated, sessionCookie, clearedSessionCookie } from '../src/worker/auth.js';

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

test('passcode check is exact and fails closed without a secret', () => {
  assert.equal(checkPasscode('secret-value', { OWNER_PASSCODE: 'secret-value' }), true);
  assert.equal(checkPasscode('secret-valu', { OWNER_PASSCODE: 'secret-value' }), false);
  assert.equal(checkPasscode(undefined, { OWNER_PASSCODE: 'secret-value' }), false);
  assert.equal(checkPasscode('', {}), false);
});

test('session cookie is HttpOnly, Secure, SameSite=Strict and verifies only with the same passcode', async () => {
  const env = { OWNER_PASSCODE: 'correct-horse-battery' };
  const cookie = await sessionCookie(env);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const value = /oo_session=([^;]+)/.exec(cookie)[1];
  const req = (v) => new Request('https://example.test/api/status', { headers: { Cookie: `oo_session=${v}` } });
  assert.equal(await isAuthenticated(req(value), env), true);
  assert.equal(await isAuthenticated(req(value), { OWNER_PASSCODE: 'changed-passcode' }), false, 'changing the passcode signs out');
  const [exp] = value.split('.');
  assert.equal(await isAuthenticated(req(`${exp}.forged`), env), false);
  assert.equal(await isAuthenticated(new Request('https://example.test/api/status'), env), false, 'no cookie');
  assert.match(clearedSessionCookie(), /Max-Age=0/);
});
