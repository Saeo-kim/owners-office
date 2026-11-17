// Cloudflare Worker entry point: public site shell, passcode login, and
// /api routed to the OfficeDO Durable Object after a valid session check.
import { FILES } from '../../dist-worker/static-files.js';
import { checkPasscode, clearedSessionCookie, isAuthenticated, sessionCookie } from './auth.js';

export { OfficeDO } from './office-do.js';

const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY, ...extra },
  });
}

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

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.', code: 'bad_request' }, 400);
  }
  if (!checkPasscode(body?.passcode, env)) {
    return json({ error: '비밀번호가 올바르지 않습니다.', code: 'bad_passcode' }, 401);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(env) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      return withSecurity(serveStatic(url.pathname));
    }
    if (!env.OWNER_PASSCODE) {
      return json({ error: 'OWNER_PASSCODE 비밀값이 설정되지 않았습니다.', code: 'not_configured' }, 503);
    }
    if (url.pathname === '/api/session' && request.method === 'GET') {
      return json({ authenticated: await isAuthenticated(request, env) });
    }
    if (url.pathname === '/api/login' && request.method === 'POST') return login(request, env);
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie() });
    }
    if (!(await isAuthenticated(request, env))) {
      return json({ error: '로그인이 필요합니다.', code: 'auth_required' }, 401);
    }
    const stub = env.OFFICE.get(env.OFFICE.idFromName('owner'));
    return withSecurity(await stub.fetch(request));
  },
};
