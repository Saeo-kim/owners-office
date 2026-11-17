// Agent API for AI team members (the CFO today). Used by Focus_Flow over localhost.
// - Off unless OFFICE_AGENT_TOKEN is set (at least 32 characters). Nothing is exposed without it.
// - Every request carries `Authorization: Bearer <token>`, compared in constant time.
// - Requests are idempotent on external_ref, so a retry never creates a second item.
// - Results are reports built from aggregates (see src/core/cfo.js); no ledger rows leave here.
import { timingSafeEqual } from 'node:crypto';
import { createAgentStore } from '../src/core/agent-store.js';
import { CFO_KINDS, inferKind, runCfo } from '../src/core/cfo.js';
import { isoDate } from '../src/core/dates.js';

export const MIN_TOKEN_LENGTH = 32;
const REF_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const AGENT_ID = 'cfo';

const fail = (status, message, errors) => ({ status, body: { error: message, ...(errors ? { errors } : {}) } });

function validateCreate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { _: 'JSON 객체가 필요합니다.' } };
  const errors = {};
  const externalRef = typeof body.external_ref === 'string' ? body.external_ref.trim() : '';
  if (!REF_RE.test(externalRef)) errors.external_ref = '외부 참조는 영문·숫자·._: - 를 써서 1–64자로 입력하세요.';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 200) errors.title = '제목은 1–200자입니다.';
  const instructions = body.instructions == null ? '' : String(body.instructions);
  if (instructions.length > 4000) errors.instructions = '지시 내용은 4000자 이하입니다.';
  if (body.kind != null && !Object.hasOwn(CFO_KINDS, body.kind)) errors.kind = `지원하지 않는 업무 유형입니다: ${body.kind}`;
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      externalRef,
      title,
      instructions,
      kind: body.kind ?? inferKind(`${title} ${instructions}`),
      requestedBy: typeof body.requested_by === 'string' ? body.requested_by.slice(0, 60) : '',
    },
  };
}

export function createAgent({ db, repo, token, now = () => new Date() }) {
  const enabled = typeof token === 'string' && token.length > 0;
  if (enabled && token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`OFFICE_AGENT_TOKEN은 ${MIN_TOKEN_LENGTH}자 이상이어야 합니다.`);
  }
  const store = createAgentStore(db);
  const expected = enabled ? Buffer.from(token) : null;
  let processing = false;

  function authorized(header) {
    const match = /^Bearer\s+(\S+)$/.exec(header ?? '');
    if (!match) return false;
    const given = Buffer.from(match[1]);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  /** Runs every queued item, one at a time. A failing item is marked failed and does not block the rest. */
  function processQueued() {
    if (processing) return 0;
    processing = true;
    let done = 0;
    try {
      for (let task = store.nextQueued(); task; task = store.nextQueued()) {
        done++;
        store.markInProgress(task.id);
        try {
          const settings = repo.getSettings();
          const data = repo.loadData({ includeDemo: settings.include_demo });
          const includesDemo = Object.values(data).some((rows) => rows.some((r) => r.is_demo));
          const { summary, result } = runCfo({ kind: task.kind, data, settings, today: isoDate(now()) });
          store.markCompleted(task.id, summary, { ...result, includes_demo: includesDemo });
        } catch (err) {
          // Log the error type only: messages and data never go to the console.
          console.error(`agent task ${task.id} failed (${err.name})`);
          store.markFailed(task.id, '처리 중 오류가 발생했습니다. 서버 로그를 확인하세요.');
        }
      }
    } finally {
      processing = false;
    }
    return done;
  }

  function handle({ method, path, query = {}, headers = {}, body = null }) {
    if (!enabled) return fail(503, 'AI 팀원 API가 꺼져 있습니다. OFFICE_AGENT_TOKEN을 설정하고 다시 시작하세요.');
    if (!authorized(headers.authorization)) return fail(401, '인증이 필요합니다.');

    const parts = path.replace(/^\/api\/agent\/?/, '').split('/').filter(Boolean);
    if (parts.length === 1 && parts[0] === 'health') {
      if (method !== 'GET') return fail(405, '허용되지 않는 메서드입니다.');
      return { status: 200, body: { ok: true, agents: { [AGENT_ID]: { label: 'CFO', kinds: CFO_KINDS } } } };
    }
    if (parts[0] !== 'tasks' || parts.length > 2) return fail(404, '경로를 찾을 수 없습니다.');

    if (parts.length === 1) {
      if (method === 'GET') {
        const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
        return { status: 200, body: store.list({ limit, externalRef: query.external_ref || undefined, status: query.status || undefined, agent: AGENT_ID }) };
      }
      if (method === 'POST') {
        const checked = validateCreate(body);
        if (checked.errors) return fail(400, Object.values(checked.errors)[0], checked.errors);
        const { task, created } = store.create({ agent: AGENT_ID, ...checked.value });
        if (created) setImmediate(processQueued);
        return { status: created ? 201 : 200, body: task };
      }
      return fail(405, '허용되지 않는 메서드입니다.');
    }

    if (method !== 'GET') return fail(405, '허용되지 않는 메서드입니다.');
    if (!/^\d+$/.test(parts[1])) return fail(404, '작업을 찾을 수 없습니다.');
    const task = store.get(parts[1], { events: true });
    return task ? { status: 200, body: task } : fail(404, '작업을 찾을 수 없습니다.');
  }

  return { enabled, handle, processQueued };
}
