// Persistence for AI-team work items (agent_tasks) and their history (agent_task_events).
// Plain SQL only, so it runs on node:sqlite and sql.js alike.
export const AGENT_STATUSES = Object.freeze(['queued', 'in_progress', 'completed', 'failed']);

const now = () => new Date().toISOString();

export function createAgentStore(db) {
  const event = (taskId, status, message = '') => {
    db.run('INSERT INTO agent_task_events (task_id, status, message) VALUES (?, ?, ?)', [taskId, status, message]);
  };
  const touch = (id, sets, params) => {
    db.run(`UPDATE agent_tasks SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`, [...params, id]);
  };
  const inTx = (fn) => {
    db.exec('BEGIN');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  function shape(row, { events = false } = {}) {
    if (!row) return null;
    const out = { ...row, result: row.result ? JSON.parse(row.result) : null };
    if (events) out.events = db.all('SELECT status, message, at FROM agent_task_events WHERE task_id = ? ORDER BY id', [row.id]);
    return out;
  }

  return {
    /** Idempotent on external_ref: sending the same reference again returns the existing item. */
    create({ agent, externalRef, kind, title, instructions, requestedBy }) {
      return inTx(() => {
        if (externalRef) {
          const existing = db.get('SELECT * FROM agent_tasks WHERE external_ref = ?', [externalRef]);
          if (existing) return { task: shape(existing), created: false };
        }
        const { lastInsertRowid } = db.run(
          `INSERT INTO agent_tasks (agent, external_ref, kind, title, instructions, status, requested_by)
           VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
          [agent, externalRef ?? null, kind, title, instructions ?? '', requestedBy ?? ''],
        );
        event(lastInsertRowid, 'queued', '접수됨');
        return { task: shape(db.get('SELECT * FROM agent_tasks WHERE id = ?', [lastInsertRowid])), created: true };
      });
    },

    get(id, options) {
      return shape(db.get('SELECT * FROM agent_tasks WHERE id = ?', [Number(id)]), options);
    },

    list({ limit = 100, externalRef, status, agent } = {}) {
      const where = [];
      const params = [];
      if (externalRef) { where.push('external_ref = ?'); params.push(externalRef); }
      if (status) { where.push('status = ?'); params.push(status); }
      if (agent) { where.push('agent = ?'); params.push(agent); }
      const sql = `SELECT * FROM agent_tasks ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
      return db.all(sql, [...params, limit]).map((row) => shape(row));
    },

    nextQueued() {
      return shape(db.get("SELECT * FROM agent_tasks WHERE status = 'queued' ORDER BY id LIMIT 1"));
    },

    markInProgress(id) {
      inTx(() => {
        touch(id, "status = 'in_progress', started_at = ?", [now()]);
        event(id, 'in_progress', '분석 시작');
      });
    },

    markCompleted(id, summary, result) {
      inTx(() => {
        touch(id, "status = 'completed', summary = ?, result = ?, error = '', completed_at = ?", [summary, JSON.stringify(result), now()]);
        event(id, 'completed', summary);
      });
    },

    markFailed(id, message) {
      inTx(() => {
        touch(id, "status = 'failed', error = ?, completed_at = ?", [message, now()]);
        event(id, 'failed', message);
      });
    },
  };
}
