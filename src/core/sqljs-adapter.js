// sql.js (SQLite compiled to WebAssembly) adapter with the same interface as
// server/sqlite.js, so the repository runs unchanged in the browser.
const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

export function wrapSqlJs(raw) {
  const all = (sql, params = []) => {
    const st = raw.prepare(sql);
    try {
      st.bind(norm(params));
      const rows = [];
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally {
      st.free();
    }
  };
  return {
    all,
    get: (sql, params = []) => all(sql, params)[0],
    run: (sql, params = []) => {
      raw.run(sql, norm(params));
      const changes = raw.getRowsModified();
      const id = raw.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
      return { changes, lastInsertRowid: Number(id) };
    },
    exec: (sql) => {
      raw.exec(sql);
    },
    export: () => raw.export(),
  };
}
