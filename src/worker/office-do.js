// Durable Object that owns the single SQLite database for this app.
import { DurableObject } from 'cloudflare:workers';
import { createOffice, runApiRequest } from './office.js';

export class OfficeDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.office = createOffice(ctx);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    let body = null;
    if (method === 'POST' || method === 'PUT') {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return Response.json({ error: 'JSON 형식이 올바르지 않습니다.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
        }
      } else {
        body = {};
      }
    }
    const query = Object.fromEntries(url.searchParams);
    const result = runApiRequest(this.office, { method, path: url.pathname, query, body });
    return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
