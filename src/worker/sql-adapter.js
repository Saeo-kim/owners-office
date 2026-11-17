// Adapter from Durable Object SQLite storage (ctx.storage.sql) to the small
// interface src/core expects: all / get / run / exec (same as server/sqlite.js).
//
// Durable Objects do not accept explicit BEGIN / COMMIT / ROLLBACK. The core
// uses them, so this adapter ignores them and instead records a ROLLBACK. The
// request wrapper (office.js) runs each request inside ctx.storage.transactionSync
// and throws when a rollback was requested or the response is an error, which
// undoes every write made during that request.

const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));
const CONTROL = /^\s*(BEGIN|COMMIT|END|ROLLBACK)\b/i;
const PRAGMA = /^\s*PRAGMA\b/i;

// Splits a SQL script into single statements. Respects '...' strings and
// -- line comments, so semicolons inside them do not split.
export function splitStatements(script) {
  const out = [];
  let cur = '';
  let inString = false;
  let inComment = false;
  for (let i = 0; i < script.length; i++) {
    const c = script[i];
    const next = script[i + 1];
    if (inComment) {
      cur += c;
      if (c === '\n') inComment = false;
      continue;
    }
    if (!inString && c === '-' && next === '-') {
      inComment = true;
      cur += c;
      continue;
    }
    if (c === "'") inString = !inString;
    if (c === ';' && !inString) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function createDoDatabase(ctx) {
  const sql = ctx.storage.sql;
  const state = { rollbackRequested: false };

  const query = (text, params = []) => sql.exec(text, ...norm(params));

  const db = {
    all: (text, params = []) => query(text, params).toArray(),
    get: (text, params = []) => query(text, params).toArray()[0],
    run: (text, params = []) => {
      query(text, params).toArray();
      const meta = query('SELECT changes() AS changes, last_insert_rowid() AS id').one();
      return { changes: Number(meta.changes), lastInsertRowid: Number(meta.id) };
    },
    exec: (script) => {
      for (const statement of splitStatements(script)) {
        if (CONTROL.test(statement)) {
          if (/^\s*ROLLBACK\b/i.test(statement)) state.rollbackRequested = true;
          continue;
        }
        if (PRAGMA.test(statement)) {
          // Some PRAGMAs (journal_mode, for example) are managed by Durable Objects.
          try {
            query(statement).toArray();
          } catch {
            /* ignored: not supported in Durable Object storage */
          }
          continue;
        }
        query(statement).toArray();
      }
    },
    close: () => {},
    // Per-request state, reset at the start of every request.
    get rollbackRequested() {
      return state.rollbackRequested;
    },
    resetRequest: () => {
      state.rollbackRequested = false;
    },
  };
  return db;
}
