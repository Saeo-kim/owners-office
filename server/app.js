// HTTP layer: static files from public/ and src/core/, JSON API via core/api.js.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOUNTS = [
  ['/core/', resolve(ROOT, 'src/core')],
  ['/', resolve(ROOT, 'public')],
];
const MAX_BODY = 5 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function sendJson(res, status, body) {
  res.writeHead(status, { ...SECURITY, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on('error', fail);
    req.on('end', () => {
      if (size > MAX_BODY) return fail(Object.assign(new Error('요청이 너무 큽니다.'), { status: 413 }));
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        ok(text ? JSON.parse(text) : null);
      } catch {
        fail(Object.assign(new Error('JSON 형식이 올바르지 않습니다.'), { status: 400 }));
      }
    });
  });
}

function serveStatic(req, res, pathname) {
  for (const [prefix, dir] of MOUNTS) {
    if (!pathname.startsWith(prefix)) continue;
    let rel = pathname.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = resolve(dir, rel);
    if (file !== dir && !file.startsWith(dir + sep)) break;
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    res.writeHead(200, { ...SECURITY, 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { ...SECURITY, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

/**
 * `agent` is optional: when given, /api/agent/* is routed to it (token-protected, see server/agent.js).
 * Without it those paths answer 404, so the agent API does not exist unless it is switched on.
 */
export function createHttpServer(api, { agent = null } = {}) {
  return createServer(async (req, res) => {
    // This app holds personal finances and has no login, so it only answers
    // requests addressed to this computer (blocks DNS-rebinding tricks too).
    if (!LOOPBACK.test(req.headers.host ?? '')) return sendJson(res, 403, { error: '로컬 접속만 허용됩니다.' });
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: '허용되지 않는 메서드입니다.' });
      return serveStatic(req, res, decodeURIComponent(url.pathname));
    }
    const isAgent = url.pathname === '/api/agent' || url.pathname.startsWith('/api/agent/');
    if (isAgent && !agent) return sendJson(res, 404, { error: '경로를 찾을 수 없습니다.' });
    try {
      let body = null;
      if (['POST', 'PUT'].includes(req.method)) {
        if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return sendJson(res, 415, { error: 'Content-Type은 application/json이어야 합니다.' });
        body = await readBody(req);
      }
      const input = { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, headers: req.headers };
      const { status, body: out } = isAgent ? agent.handle(input) : api.handle(input);
      sendJson(res, status, out);
    } catch (err) {
      sendJson(res, err.status ?? 500, { error: err.status ? err.message : '서버 오류가 발생했습니다.' });
    }
  });
}
