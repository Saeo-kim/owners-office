// node:sqlite adapter exposing the small interface src/core expects.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../src/core/schema.js';

const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA journal_mode = WAL');
  const cache = new Map();
  const prep = (sql) => {
    let st = cache.get(sql);
    if (!st) cache.set(sql, (st = raw.prepare(sql)));
    return st;
  };
  const db = {
    all: (sql, params = []) => prep(sql).all(...norm(params)).map((r) => ({ ...r })),
    get: (sql, params = []) => {
      const r = prep(sql).get(...norm(params));
      return r ? { ...r } : undefined;
    },
    run: (sql, params = []) => {
      const r = prep(sql).run(...norm(params));
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
    exec: (sql) => raw.exec(sql),
    close: () => raw.close(),
  };
  migrate(db);
  return db;
}
