// Chooses how the UI talks to its data.
//  server  — fetch() to the local Node server (SQLite file on disk)
//  browser — the same core API running in this tab on sql.js, saved to IndexedDB
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error ?? `요청 실패 (${status})`);
    this.status = status;
    this.errors = body?.errors;
  }
}

function wrap(request, mode) {
  return {
    mode,
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b ?? {}),
    put: (p, b) => request('PUT', p, b),
    del: (p) => request('DELETE', p),
  };
}

export async function createBackend() {
  const mode = document.querySelector('meta[name="oo-mode"]')?.content ?? 'server';
  if (mode === 'server') {
    return wrap(async (method, path, body) => {
      const res = await fetch(`/api${path}`, {
        method,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, data);
      return data;
    }, 'server');
  }
  return createBrowserBackend();
}

// ---------- browser mode
const IDB_NAME = 'owners-office';
const IDB_KEY = 'sqlite';

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet() {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('files').objectStore('files').get(IDB_KEY);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(bytes) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('files', 'readwrite');
    t.objectStore('files').put(bytes, IDB_KEY);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`${src}를 불러오지 못했습니다.`));
    document.head.append(s);
  });
}

async function createBrowserBackend() {
  const [{ createApi }, { createRepository }, { migrate }, { wrapSqlJs }, { seedDemo }] = await Promise.all([
    import('../core/api.js'),
    import('../core/repository.js'),
    import('../core/schema.js'),
    import('../core/sqljs-adapter.js'),
    import('../core/seed.js'),
  ]);
  await loadScript('vendor/sql-wasm.js');
  const SQL = await window.initSqlJs({ locateFile: (f) => `vendor/${f}` });
  let saved = null;
  try {
    saved = await idbGet();
  } catch {
    saved = null; // private mode etc.: works for this session only
  }
  const db = wrapSqlJs(saved ? new SQL.Database(saved) : new SQL.Database());
  migrate(db);
  const repo = createRepository(db);
  const persist = async () => {
    try {
      await idbPut(db.export());
    } catch (err) {
      console.warn('IndexedDB 저장 실패', err);
    }
  };
  if (!repo.getSettings().demo_seeded) {
    seedDemo(repo);
    await persist();
  }
  const api = createApi({ repo, mode: 'browser' });
  return wrap(async (method, path, body) => {
    const url = new URL(path, 'http://local');
    const { status, body: out } = api.handle({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: body === undefined ? null : JSON.parse(JSON.stringify(body)),
    });
    if (method !== 'GET' && status < 400) await persist();
    if (status >= 400) throw new ApiError(status, out);
    return out;
  }, 'browser');
}
