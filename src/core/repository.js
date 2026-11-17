// Validation and storage. `db` is a small adapter with all/get/run/exec,
// backed by node:sqlite on the server and sql.js in the browser.
import { RESOURCES, RESOURCE_NAMES } from './resources.js';

export class ValidationError extends Error {
  constructor(errors) {
    super(Object.values(errors)[0] ?? '입력값이 올바르지 않습니다.');
    this.errors = errors;
    this.status = 400;
  }
}

export class NotFoundError extends Error {
  constructor(message = '항목을 찾을 수 없습니다.') {
    super(message);
    this.status = 404;
  }
}

export const DEFAULT_SETTINGS = Object.freeze({
  include_demo: true,
  max_active_ventures: 3,
  demo_seeded: false,
  hourly_value: 20000,
});

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function coerce(spec, raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  switch (spec.type) {
    case 'text':
    case 'textarea': {
      const value = String(raw).trim();
      if (value.length > spec.max) return { error: `${spec.max}자 이하로 입력하세요.` };
      return { value: value === '' ? null : value };
    }
    case 'int':
    case 'ref': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s원]/g, ''));
      if (!Number.isFinite(n) || !Number.isInteger(n)) return { error: '정수를 입력하세요.' };
      if (spec.min !== undefined && n < spec.min) return { error: `${spec.min} 이상이어야 합니다.` };
      if (spec.max !== undefined && n > spec.max) return { error: `${spec.max} 이하여야 합니다.` };
      return { value: n };
    }
    case 'bool':
      return { value: raw === true || raw === 1 || raw === '1' || raw === 'true' || raw === 'on' ? 1 : 0 };
    case 'date':
      return isRealDate(String(raw)) ? { value: String(raw) } : { error: 'YYYY-MM-DD 형식의 날짜를 입력하세요.' };
    case 'enum':
      return Object.hasOwn(spec.values, raw) ? { value: raw } : { error: '허용되지 않는 값입니다.' };
    default:
      return { error: '알 수 없는 필드' };
  }
}

export function createRepository(db) {
  const tx = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  const def = (name) => {
    const d = RESOURCES[name];
    if (!d) throw new NotFoundError(`알 수 없는 리소스: ${name}`);
    return d;
  };

  function validate(name, input, existing = null) {
    const d = def(name);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError({ _: 'JSON 객체가 필요합니다.' });
    const errors = {};
    const record = {};
    for (const [key, spec] of Object.entries(d.fields)) {
      const provided = Object.hasOwn(input, key);
      let raw = provided ? input[key] : existing ? existing[key] : undefined;
      if (!provided && !existing && raw === undefined && spec.default !== undefined) raw = spec.default;
      const { value, error } = coerce(spec, raw);
      if (error) errors[key] = `${spec.label}: ${error}`;
      else record[key] = value;
    }
    // Hidden fields are cleared so stale values never feed a calculation.
    for (const [key, spec] of Object.entries(d.fields)) {
      if (spec.showIf && !spec.showIf(record)) record[key] = null;
    }
    d.check?.(record, errors);
    for (const [key, spec] of Object.entries(d.fields)) {
      if (errors[key]) continue;
      if (spec.required && (record[key] === null || record[key] === undefined)) errors[key] = `${spec.label}: 필수 항목입니다.`;
      if (spec.type === 'ref' && record[key] !== null && record[key] !== undefined) {
        const target = RESOURCES[spec.resource].table;
        if (!db.get(`SELECT id FROM ${target} WHERE id = ?`, [record[key]])) errors[key] = `${spec.label}: 존재하지 않는 항목입니다.`;
      }
      if ((spec.type === 'text' || spec.type === 'textarea') && record[key] === null && !spec.required) record[key] = '';
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);
    return record;
  }

  function list(name, { includeDemo = true } = {}) {
    const d = def(name);
    const where = includeDemo ? '' : 'WHERE is_demo = 0';
    return db.all(`SELECT * FROM ${d.table} ${where} ORDER BY ${d.order}`);
  }

  function get(name, id) {
    const row = db.get(`SELECT * FROM ${def(name).table} WHERE id = ?`, [Number(id)]);
    if (!row) throw new NotFoundError();
    return row;
  }

  // Records created through the API are always real data (is_demo = 0).
  function create(name, input, { demo = false } = {}) {
    const d = def(name);
    const record = validate(name, input);
    const cols = Object.keys(record);
    const result = db.run(
      `INSERT INTO ${d.table} (${cols.join(', ')}, is_demo) VALUES (${cols.map(() => '?').join(', ')}, ?)`,
      [...cols.map((c) => record[c]), demo ? 1 : 0],
    );
    return get(name, result.lastInsertRowid);
  }

  function update(name, id, input) {
    const d = def(name);
    const existing = get(name, id);
    const record = validate(name, input, existing);
    const cols = Object.keys(record);
    db.run(
      `UPDATE ${d.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`,
      [...cols.map((c) => record[c]), existing.id],
    );
    return get(name, id);
  }

  function remove(name, id) {
    const existing = get(name, id);
    db.run(`DELETE FROM ${def(name).table} WHERE id = ?`, [existing.id]);
    return { deleted: existing.id };
  }

  function getSettings() {
    const out = { ...DEFAULT_SETTINGS };
    for (const { key, value } of db.all('SELECT key, value FROM settings')) {
      if (Object.hasOwn(DEFAULT_SETTINGS, key)) out[key] = JSON.parse(value);
    }
    return out;
  }

  function saveSettings(input) {
    const errors = {};
    const clean = {};
    if (input?.include_demo !== undefined) clean.include_demo = Boolean(input.include_demo);
    if (input?.max_active_ventures !== undefined) {
      const n = Number(input.max_active_ventures);
      if (!Number.isInteger(n) || n < 1 || n > 20) errors.max_active_ventures = '동시 진행 한도는 1–20 사이 정수입니다.';
      else clean.max_active_ventures = n;
    }
    if (input?.hourly_value !== undefined) {
      const n = Number(input.hourly_value);
      if (!Number.isInteger(n) || n < 0 || n > 10_000_000) errors.hourly_value = '시간 가치는 0 이상 정수(원)입니다.';
      else clean.hourly_value = n;
    }
    if (input?.demo_seeded !== undefined) clean.demo_seeded = Boolean(input.demo_seeded);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    for (const [key, value] of Object.entries(clean)) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
    }
    return getSettings();
  }

  // Everything the analytics need, in one consistent snapshot.
  function loadData({ includeDemo } = {}) {
    const demo = includeDemo ?? getSettings().include_demo;
    const data = {};
    for (const name of RESOURCE_NAMES) data[name] = list(name, { includeDemo: demo });
    return data;
  }

  function counts() {
    const out = {};
    for (const name of RESOURCE_NAMES) {
      const t = RESOURCES[name].table;
      out[name] = db.get(`SELECT COUNT(*) AS total, COALESCE(SUM(is_demo), 0) AS demo FROM ${t}`);
    }
    return out;
  }

  function deleteDemo() {
    return tx(() => {
      let removed = 0;
      // Children first so ON DELETE rules never touch real rows unexpectedly.
      for (const t of ['work_logs', 'plans', 'transactions', 'goals', 'employees', 'ventures', 'accounts']) {
        removed += db.run(`DELETE FROM ${t} WHERE is_demo = 1`).changes;
      }
      return { removed };
    });
  }

  function exportAll() {
    const records = {};
    for (const name of RESOURCE_NAMES) records[name] = db.all(`SELECT * FROM ${RESOURCES[name].table} ORDER BY id`);
    return { format: 'owners-office', version: 1, exported_at: new Date().toISOString(), settings: getSettings(), records };
  }

  // Replaces everything. Ids are preserved so links between records survive.
  function importAll(payload) {
    if (payload?.format !== 'owners-office' || !payload.records) throw new ValidationError({ _: 'OWNER\'S OFFICE 백업 파일이 아닙니다.' });
    const order = ['accounts', 'employees', 'ventures', 'goals', 'plans', 'transactions', 'worklogs'];
    return tx(() => {
      for (const name of [...order].reverse()) db.run(`DELETE FROM ${RESOURCES[name].table}`);
      let imported = 0;
      for (const name of order) {
        for (const row of payload.records[name] ?? []) {
          let record;
          try {
            record = validate(name, row);
          } catch (err) {
            if (err instanceof ValidationError) throw new ValidationError({ _: `${RESOURCES[name].label} #${row.id}: ${err.message}` });
            throw err;
          }
          const cols = Object.keys(record);
          db.run(
            `INSERT INTO ${RESOURCES[name].table} (id, ${cols.join(', ')}, is_demo) VALUES (?, ${cols.map(() => '?').join(', ')}, ?)`,
            [Number(row.id), ...cols.map((c) => record[c]), row.is_demo ? 1 : 0],
          );
          imported++;
        }
      }
      if (payload.settings) saveSettings(payload.settings);
      return { imported };
    });
  }

  return { tx, validate, list, get, create, update, remove, getSettings, saveSettings, loadData, counts, deleteDemo, exportAll, importAll };
}
