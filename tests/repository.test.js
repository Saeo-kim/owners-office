import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup } from './helpers.js';

test('creates, reads, updates and deletes every resource', () => {
  const { call } = setup();
  const v = call('POST', '/ventures', { name: '사업', stage: 'idea' });
  assert.equal(v.status, 201);
  const g = call('POST', '/goals', { title: '목표', period_type: 'monthly', period: '2026-11', metric: 'business_revenue', target_value: 1000 });
  const samples = {
    accounts: [{ name: '통장', kind: 'bank', balance: 1000, as_of: '2026-11-01' }, { balance: 2000 }],
    employees: [{ name: '노트북', department: 'operations', kind: 'device', monthly_cost: 0, usage_frequency: 'daily' }, { status: 'review' }],
    transactions: [{ date: '2026-11-02', direction: 'income', amount: 5000, income_type: 'business_revenue', venture_id: v.body.id }, { amount: 6000 }],
    plans: [{ goal_id: g.body.id, title: '계획' }, { status: 'done' }],
    worklogs: [{ date: '2026-11-03', task: '개발', category: 'build', minutes: 90 }, { output: '배포' }],
    receivables: [{ client: '고객사', title: '잔금', amount: 300000, status: 'invoiced', venture_id: v.body.id, due_date: '2026-11-30' }, { note: '확인' }],
    obligations: [{ kind: 'vat', title: '부가세', amount: 50000, due_date: '2027-01-25' }, { status: 'paid' }],
  };
  for (const [resource, [create, patch]] of Object.entries(samples)) {
    const c = call('POST', `/${resource}`, create);
    assert.equal(c.status, 201, `${resource}: ${JSON.stringify(c.body)}`);
    assert.equal(c.body.is_demo, 0, 'API-created rows are real data');
    const u = call('PUT', `/${resource}/${c.body.id}`, patch);
    assert.equal(u.status, 200);
    for (const [k, val] of Object.entries(patch)) assert.equal(u.body[k], val);
    assert.equal(call('GET', `/${resource}/${c.body.id}`).status, 200);
    assert.equal(call('DELETE', `/${resource}/${c.body.id}`).status, 200);
    assert.equal(call('GET', `/${resource}/${c.body.id}`).status, 404);
  }
});

test('rejects invalid input with field-level messages', () => {
  const { call } = setup();
  let r = call('POST', '/transactions', { date: '2026-02-30', direction: 'expense', amount: -5 });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.date);
  assert.ok(r.body.errors.amount);
  r = call('POST', '/transactions', { date: '2026-11-01', direction: 'expense', amount: 100 });
  assert.deepEqual(Object.keys(r.body.errors).sort(), ['cost_class', 'cost_nature', 'scope']);
  r = call('POST', '/transactions', { date: '2026-11-01', direction: 'income', amount: 100 });
  assert.ok(r.body.errors.income_type);
  r = call('POST', '/transactions', { date: '2026-11-01', direction: 'income', amount: 100, income_type: 'nope' });
  assert.ok(r.body.errors.income_type);
  r = call('POST', '/transactions', { date: '2026-11-01', direction: 'income', amount: 100, income_type: 'grant', venture_id: 999 });
  assert.match(r.body.errors.venture_id, /존재하지 않는/);
  r = call('POST', '/goals', { title: 'x', period_type: 'yearly', period: '2026-11', metric: 'outputs', target_value: 1 });
  assert.ok(r.body.errors.period);
  r = call('POST', '/employees', { name: 'x', department: 'operations', kind: 'device', usage_frequency: 'daily', purchase_price: 1000 });
  assert.ok(r.body.errors.useful_life_months);
  r = call('POST', '/ventures', { name: 'x', stage: 'idea', expected_monthly_revenue: 1000 });
  assert.ok(r.body.errors.forecast_confidence, 'a forecast needs a stated confidence');
  r = call('POST', '/accounts', 'not an object');
  assert.equal(r.status, 400);
});

test('income rows never keep expense classification and vice versa', () => {
  const { call } = setup();
  const r = call('POST', '/transactions', { date: '2026-11-01', direction: 'income', amount: 100, income_type: 'grant', scope: 'business', cost_class: 'labor' });
  assert.equal(r.status, 201);
  assert.equal(r.body.scope, null);
  assert.equal(r.body.cost_class, null);
  const u = call('PUT', `/transactions/${r.body.id}`, { direction: 'expense', scope: 'personal', cost_nature: 'fixed', cost_class: 'living' });
  assert.equal(u.body.income_type, null);
});

test('money accepts formatted strings', () => {
  const { call } = setup();
  const r = call('POST', '/accounts', { name: 'a', kind: 'bank', balance: '1,234,000원', as_of: '2026-11-01' });
  assert.equal(r.body.balance, 1234000);
});

test('demo data is flagged, removable, and never touches real rows', () => {
  const { call } = setup();
  const real = call('POST', '/accounts', { name: '실제 통장', kind: 'bank', balance: 500, as_of: '2026-11-01' }).body;
  const seeded = call('POST', '/demo');
  assert.equal(seeded.status, 200);
  assert.ok(seeded.body.created > 100);
  assert.equal(call('POST', '/demo').status, 400, 'seeding twice is refused');
  const counts = call('GET', '/status').body.counts;
  assert.equal(counts.accounts.total - counts.accounts.demo, 1);
  const removed = call('DELETE', '/demo').body.removed;
  assert.equal(removed, seeded.body.created);
  const left = call('GET', '/accounts').body;
  assert.deepEqual(left.map((a) => a.id), [real.id]);
});

test('include_demo=false hides demo rows from lists and analysis', () => {
  const { call } = setup();
  call('POST', '/demo');
  call('POST', '/transactions', { date: '2026-11-05', direction: 'income', amount: 777, income_type: 'business_revenue' });
  call('PUT', '/settings', { include_demo: false });
  assert.equal(call('GET', '/transactions').body.length, 1);
  assert.ok(call('GET', '/transactions?demo=all').body.length > 1);
  const d = call('GET', '/analysis/dashboard').body;
  assert.equal(d.current.revenue, 777);
  assert.equal(d.includesDemo, false);
});

test('settings are validated', () => {
  const { call } = setup();
  assert.equal(call('PUT', '/settings', { max_active_ventures: 0 }).status, 400);
  assert.equal(call('PUT', '/settings', { max_active_ventures: 5 }).body.max_active_ventures, 5);
});

test('export and import round-trip all records with ids and demo flags', () => {
  const a = setup();
  a.call('POST', '/demo');
  a.call('POST', '/accounts', { name: '실제', kind: 'cash', balance: 1, as_of: '2026-11-01' });
  const backup = a.call('GET', '/export').body;
  const b = setup();
  const r = b.call('POST', '/import', backup);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const again = b.call('GET', '/export').body;
  for (const k of Object.keys(backup.records)) {
    assert.deepEqual(again.records[k].map((x) => [x.id, x.is_demo]), backup.records[k].map((x) => [x.id, x.is_demo]), k);
  }
  assert.deepEqual(b.call('GET', '/analysis/dashboard').body.current, a.call('GET', '/analysis/dashboard').body.current);
  assert.equal(b.call('POST', '/import', { foo: 1 }).status, 400);
});

test('deleting a goal cascades to its plans; deleting a venture unlinks transactions', () => {
  const { call } = setup();
  const v = call('POST', '/ventures', { name: 'v', stage: 'idea' }).body;
  const g = call('POST', '/goals', { title: 'g', period_type: 'yearly', period: '2026', metric: 'outputs', target_value: 3 }).body;
  const p = call('POST', '/plans', { goal_id: g.id, title: 'p' }).body;
  const t = call('POST', '/transactions', { date: '2026-11-01', direction: 'income', amount: 10, income_type: 'business_revenue', venture_id: v.id }).body;
  call('DELETE', `/goals/${g.id}`);
  assert.equal(call('GET', `/plans/${p.id}`).status, 404);
  call('DELETE', `/ventures/${v.id}`);
  assert.equal(call('GET', `/transactions/${t.id}`).body.venture_id, null);
});

test('unknown routes and methods', () => {
  const { call } = setup();
  assert.equal(call('GET', '/nope').status, 404);
  assert.equal(call('PATCH', '/accounts').status, 405);
  assert.equal(call('GET', '/accounts/abc').status, 404);
  assert.equal(call('GET', '/analysis/dashboard?month=2026-13').status, 400);
});
