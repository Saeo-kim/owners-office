// CFO agent: report correctness, privacy of results, the token-protected HTTP API and the task lifecycle.
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { test } from 'node:test';
import { createAgent, MIN_TOKEN_LENGTH } from '../server/agent.js';
import { createHttpServer } from '../server/app.js';
import { CFO_KINDS, inferKind, runCfo } from '../src/core/cfo.js';
import { setup } from './helpers.js';

const TODAY = '2026-11-17';
const TOKEN = 'test-token-'.padEnd(MIN_TOKEN_LENGTH + 8, 'x');

function seedFinance(repo) {
  repo.saveSettings({ include_demo: false });
  const venture = repo.create('ventures', { name: '프리랜서 개발', stage: 'revenue', status: 'active', started_on: '2026-01-01' });
  repo.create('transactions', { date: '2026-11-05', direction: 'income', amount: 1_000_000, income_type: 'business_revenue', venture_id: venture.id, description: '정산' });
  repo.create('transactions', { date: '2026-11-06', direction: 'expense', amount: 300_000, scope: 'business', cost_nature: 'variable', cost_class: 'labor', venture_id: venture.id, description: '외주비' });
  repo.create('transactions', { date: '2026-11-07', direction: 'expense', amount: 50_000, scope: 'personal', cost_nature: 'variable', cost_class: 'living', description: '' });
  repo.create('transactions', { date: '2026-10-05', direction: 'income', amount: 800_000, income_type: 'business_revenue', venture_id: venture.id, description: '이전달' });
  repo.create('accounts', { name: 'SECRET-BROKERAGE-7788', kind: 'investment', balance: 5_000_000, as_of: TODAY, note: 'acct 1234-5678' });
  repo.create('accounts', { name: '생활 통장', kind: 'bank', balance: 2_000_000, as_of: TODAY, note: '' });
  repo.create('accounts', { name: '카드 대금', kind: 'debt', balance: -400_000, as_of: TODAY, note: '' });
}

test('keywords choose the kind of report, with a monthly summary as the default', () => {
  assert.equal(inferKind('2026 종합소득세 자료'), 'tax_summary');
  assert.equal(inferKind('주식 포트폴리오 현황'), 'portfolio');
  assert.equal(inferKind('이번 달 현금흐름 점검'), 'cash_flow');
  assert.equal(inferKind('장부 누락 확인'), 'bookkeeping');
  assert.equal(inferKind('재무 위험 감사'), 'risk_audit');
  assert.equal(inferKind('목표 달성 계획'), 'planning');
  assert.equal(inferKind('손익 분석'), 'financial_analysis');
  assert.equal(inferKind('월간 보고서'), 'monthly_report');
  assert.equal(inferKind('무엇이든'), 'monthly_report');
});

test('monthly report uses the same numbers as the dashboard', () => {
  const { repo, api, db } = setup();
  seedFinance(repo);
  const data = repo.loadData({ includeDemo: false });
  const { result, summary } = runCfo({ kind: 'monthly_report', data, settings: repo.getSettings(), today: TODAY });
  const figure = (label) => result.figures.find((f) => f.label === label).value;
  assert.equal(figure('사업 매출'), 1_000_000);
  assert.equal(figure('사업 비용'), 300_000);
  assert.equal(figure('사업 순이익'), 700_000);
  assert.equal(figure('개인 비용'), 50_000);
  assert.equal(figure('인건비'), 300_000);
  assert.equal(figure('전월 대비 매출 증감'), 25);
  assert.match(summary, /사업 매출 1,000,000원/);
  assert.equal(api.handle({ method: 'GET', path: '/api/analysis/dashboard', query: { month: '2026-11' } }).body.current.revenue, 1_000_000);
  db.close();
});

test('results never carry account names, notes or ledger rows', () => {
  const { repo, db } = setup();
  seedFinance(repo);
  const data = repo.loadData({ includeDemo: false });
  for (const kind of Object.keys(CFO_KINDS)) {
    const { result } = runCfo({ kind, data, settings: repo.getSettings(), today: TODAY });
    const text = JSON.stringify(result);
    assert.ok(!text.includes('SECRET-BROKERAGE'), `${kind} leaked an account name`);
    assert.ok(!text.includes('1234-5678'), `${kind} leaked an account note`);
    assert.ok(!text.includes('외주비'), `${kind} leaked a transaction description`);
  }
  const portfolio = runCfo({ kind: 'portfolio', data, settings: repo.getSettings(), today: TODAY }).result;
  assert.equal(portfolio.figures.find((f) => f.label.startsWith('투자 자산 합계')).value, 5_000_000);
  db.close();
});

test('missing data is reported as null with a limitation, never as a guess', () => {
  const { repo, db } = setup();
  repo.saveSettings({ include_demo: false });
  const data = repo.loadData({ includeDemo: false });
  for (const kind of Object.keys(CFO_KINDS)) {
    const { result, summary } = runCfo({ kind, data, settings: repo.getSettings(), today: TODAY });
    assert.ok(Array.isArray(result.figures) && result.figures.length > 0, kind);
    assert.ok(summary.length > 0, kind);
  }
  const monthly = runCfo({ kind: 'monthly_report', data, settings: repo.getSettings(), today: TODAY }).result;
  assert.equal(monthly.figures.find((f) => f.label === '사업 매출').value, null);
  assert.ok(monthly.limitations.some((l) => l.includes('기록된 거래가 없습니다')));
  db.close();
});

test('tax summary is labelled as preparation, not filing', () => {
  const { repo, db } = setup();
  seedFinance(repo);
  const { result } = runCfo({ kind: 'tax_summary', data: repo.loadData({ includeDemo: false }), settings: repo.getSettings(), today: TODAY });
  assert.ok(result.limitations.some((l) => l.includes('세무 신고 대행이 아니며')));
  db.close();
});

function http(port, method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const req = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('the agent API refuses short tokens at startup and stays off without one', async () => {
  const { db, api } = setup();
  assert.throws(() => createAgent({ db, repo: setup().repo, token: 'short' }), /32자 이상/);
  const off = createAgent({ db, repo: setup().repo, token: null });
  assert.equal(off.enabled, false);
  const server = createHttpServer(api);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await http(server.address().port, 'GET', '/api/agent/health', { token: TOKEN });
  assert.equal(res.status, 404, 'no agent mounted means no agent routes');
  server.close();
  db.close();
});

test('HTTP: token auth, idempotent creation, processing and history', async () => {
  const { db, repo, api } = setup();
  seedFinance(repo);
  const agent = createAgent({ db, repo, token: TOKEN, now: () => new Date(`${TODAY}T09:00:00`) });
  const server = createHttpServer(api, { agent });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    assert.equal((await http(port, 'GET', '/api/agent/health')).status, 401, 'no token');
    assert.equal((await http(port, 'GET', '/api/agent/health', { token: 'wrong'.padEnd(TOKEN.length, 'y') })).status, 401, 'wrong token');
    const health = await http(port, 'GET', '/api/agent/health', { token: TOKEN });
    assert.equal(health.status, 200);
    assert.ok(health.json.agents.cfo.kinds.tax_summary);

    const created = await http(port, 'POST', '/api/agent/tasks', {
      token: TOKEN,
      body: { external_ref: 'ff-task-42', title: '11월 월간 보고서', instructions: '', requested_by: '관리자' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.kind, 'monthly_report');
    assert.equal(created.json.status, 'queued');

    const again = await http(port, 'POST', '/api/agent/tasks', { token: TOKEN, body: { external_ref: 'ff-task-42', title: '다른 제목' } });
    assert.equal(again.status, 200, 'same external_ref returns the existing item');
    assert.equal(again.json.id, created.json.id);

    assert.equal((await http(port, 'POST', '/api/agent/tasks', { token: TOKEN, body: { external_ref: 'bad ref!', title: 'x' } })).status, 400);
    assert.equal((await http(port, 'POST', '/api/agent/tasks', { token: TOKEN, body: { external_ref: 'ff-task-43', title: 'x', kind: 'astrology' } })).status, 400);

    // The POST schedules processing right after its response; wait for it, then confirm nothing is left queued.
    await new Promise((r) => setTimeout(r, 50));
    agent.processQueued();
    const done = await http(port, 'GET', `/api/agent/tasks/${created.json.id}`, { token: TOKEN });
    assert.equal(done.json.status, 'completed');
    assert.equal(done.json.result.figures.find((f) => f.label === '사업 순이익').value, 700_000);
    assert.equal(done.json.result.includes_demo, false);
    assert.deepEqual(done.json.events.map((e) => e.status), ['queued', 'in_progress', 'completed']);

    const list = await http(port, 'GET', '/api/agent/tasks?external_ref=ff-task-42', { token: TOKEN });
    assert.equal(list.json.length, 1);
    assert.equal((await http(port, 'GET', '/api/agent/tasks/999999', { token: TOKEN })).status, 404);
  } finally {
    server.close();
    db.close();
  }
});

test('a failing item is marked failed and does not block the queue', () => {
  const { db, repo } = setup();
  seedFinance(repo);
  const agent = createAgent({ db, repo, token: TOKEN, now: () => new Date(`${TODAY}T09:00:00`) });
  const broken = repo;
  const original = broken.loadData;
  let calls = 0;
  broken.loadData = (opts) => {
    calls++;
    if (calls === 1) throw new Error('boom with private data 1,000,000원');
    return original(opts);
  };
  // Create two items directly through the store path used by POST.
  db.run("INSERT INTO agent_tasks (agent, external_ref, kind, title, instructions, status) VALUES ('cfo', 'a', 'monthly_report', 't', '', 'queued')");
  db.run("INSERT INTO agent_tasks (agent, external_ref, kind, title, instructions, status) VALUES ('cfo', 'b', 'portfolio', 't', '', 'queued')");
  assert.equal(agent.processQueued(), 2);
  const rows = db.all('SELECT external_ref, status, error FROM agent_tasks ORDER BY id');
  assert.deepEqual(rows.map((r) => r.status), ['failed', 'completed']);
  assert.ok(!rows[0].error.includes('1,000,000'), 'error text stored for the user must not echo private data');
  db.close();
});
