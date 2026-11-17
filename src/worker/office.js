// The owner's database and API inside one Durable Object. Kept free of
// Cloudflare-only imports so the same code runs under node:test.
import { createApi } from '../core/api.js';
import { createRepository } from '../core/repository.js';
import { migrate } from '../core/schema.js';
import { createDoDatabase } from './sql-adapter.js';

// Thrown inside transactionSync to undo every write made by one request.
class RolledBack extends Error {
  constructor(result) {
    super('rolled back');
    this.result = result;
  }
}

export function createOffice(ctx) {
  const db = createDoDatabase(ctx);
  ctx.storage.transactionSync(() => migrate(db));
  const repo = createRepository(db);
  const api = createApi({ repo, mode: 'cloud' });
  return { db, api, ctx };
}

// Runs one API request atomically: any write followed by an error status is undone.
export function runApiRequest(office, { method, path, query, body }) {
  const { db, api, ctx } = office;
  try {
    return ctx.storage.transactionSync(() => {
      db.resetRequest();
      const result = api.handle({ method, path, query, body });
      if (db.rollbackRequested || result.status >= 400) throw new RolledBack(result);
      return result;
    });
  } catch (err) {
    if (err instanceof RolledBack) return err.result;
    console.error(err);
    return { status: 500, body: { error: '서버 오류가 발생했습니다.' } };
  }
}
