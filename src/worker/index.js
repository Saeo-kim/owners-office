// Cloudflare Worker entry point: passcode gate, static assets, and /api routed
// to the OfficeDO Durable Object.
import { authorize } from './auth.js';
import { FILES } from '../../dist-worker/static-files.js';

export { OfficeDO } from './office-do.js';

const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function withSecurity(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY)) out.headers.set(k, v);
  return out;
}

function serveStatic(pathname) {
  const file = FILES[pathname === '/' ? '/index.html' : pathname];
  if (!file) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'Content-Type': file.type, 'Cache-Control': 'no-cache' } });
}

export default {
  async fetch(request, env) {
    const denied = authorize(request, env);
    if (denied) return withSecurity(denied);

    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const stub = env.OFFICE.get(env.OFFICE.idFromName('owner'));
      return withSecurity(await stub.fetch(request));
    }
    return withSecurity(serveStatic(url.pathname));
  },
};
