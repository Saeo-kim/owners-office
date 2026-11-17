// Versioned migrations. The same SQL runs on node:sqlite (local mode)
// and sql.js (browser mode), so stick to plain SQLite.

const ts = `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;

export const MIGRATIONS = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    balance INTEGER NOT NULL,
    liquid INTEGER NOT NULL DEFAULT 1,
    as_of TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );

  CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    kind TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    duties TEXT NOT NULL DEFAULT '',
    monthly_cost INTEGER NOT NULL DEFAULT 0,
    purchase_price INTEGER,
    useful_life_months INTEGER,
    usage_frequency TEXT NOT NULL,
    contribution INTEGER,
    satisfaction INTEGER,
    monthly_value INTEGER,
    value_basis TEXT NOT NULL DEFAULT '',
    overlap_group TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'keep',
    started_on TEXT,
    note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );

  CREATE TABLE ventures (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    started_on TEXT,
    expected_monthly_revenue INTEGER,
    forecast_basis TEXT NOT NULL DEFAULT '',
    forecast_confidence TEXT,
    note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    income_type TEXT,
    scope TEXT,
    cost_nature TEXT,
    cost_class TEXT,
    venture_id INTEGER REFERENCES ventures(id) ON DELETE SET NULL,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    description TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );
  CREATE INDEX transactions_date ON transactions(date);

  CREATE TABLE goals (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    period_type TEXT NOT NULL,
    period TEXT NOT NULL,
    metric TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    manual_actual INTEGER,
    venture_id INTEGER REFERENCES ventures(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );

  CREATE TABLE plans (
    id INTEGER PRIMARY KEY,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    planned_minutes INTEGER,
    note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );

  CREATE TABLE work_logs (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    venture_id INTEGER REFERENCES ventures(id) ON DELETE SET NULL,
    goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    task TEXT NOT NULL,
    category TEXT NOT NULL,
    minutes INTEGER NOT NULL CHECK (minutes > 0),
    output TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    ${ts}
  );
  CREATE INDEX work_logs_date ON work_logs(date);
  `,

  // v2 · AI 팀원(CFO) 업무 큐. 새 테이블 두 개만 추가하며 기존 테이블은 바꾸지 않습니다.
  `
  CREATE TABLE agent_tasks (
    id INTEGER PRIMARY KEY,
    agent TEXT NOT NULL,
    external_ref TEXT UNIQUE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    summary TEXT NOT NULL DEFAULT '',
    result TEXT,
    error TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    completed_at TEXT,
    ${ts}
  );
  CREATE INDEX agent_tasks_status ON agent_tasks(status);

  CREATE TABLE agent_task_events (
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE INDEX agent_task_events_task ON agent_task_events(task_id);
  `,
];

export function migrate(db) {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.get('SELECT version FROM schema_version');
  let version = row ? row.version : 0;
  if (!row) db.run('INSERT INTO schema_version (version) VALUES (0)');
  for (; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.run('UPDATE schema_version SET version = ?', [version + 1]);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return version;
}
