import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runAudit } from '../src/core/audit.js';
import { emptyData, employee, expense, goal, income, log, venture } from './helpers.js';

const TODAY = '2026-11-15';
const S = { max_active_ventures: 2, hourly_value: 10000 };
const rules = (findings) => findings.map((f) => f.rule);

function assertWellFormed(findings) {
  for (const f of findings) {
    assert.ok(['high', 'medium', 'low', 'info'].includes(f.severity));
    assert.ok(f.title && f.recommendation, `${f.rule} has title and recommendation`);
    assert.ok(Array.isArray(f.sources) && f.sources.length > 0, `${f.rule} cites a source`);
    assert.ok(['actual', 'estimate'].includes(f.basis));
  }
}

test('empty data produces only data-gap notices, no invented numbers', () => {
  const f = runAudit(emptyData(), S, TODAY);
  assert.deepEqual(rules(f), ['data_gap']);
  assert.match(f[0].title, /계좌/);
  assertWellFormed(f);
});

test('forecast without basis is flagged high; inflated forecast medium', () => {
  const d = emptyData();
  const a = venture({ name: 'A', expected_monthly_revenue: 1000, forecast_confidence: 'high', forecast_basis: '' });
  const b = venture({ name: 'B', expected_monthly_revenue: 1000, forecast_confidence: 'low', forecast_basis: '계약' });
  d.ventures.push(a, b);
  d.transactions.push(income('2026-10-02', 100, 'business_revenue', { venture_id: b.id }));
  const f = runAudit(d, S, TODAY).filter((x) => x.rule === 'weak_forecast');
  assert.equal(f.length, 2);
  assert.equal(f.find((x) => x.ref.id === a.id).severity, 'high');
  assert.match(f.find((x) => x.ref.id === b.id).title, /30.3배/); // 1000 ÷ round(100 / 3)
  assertWellFormed(f);
});

test('too many active ventures and stalled ventures', () => {
  const d = emptyData();
  const v = [venture({}), venture({}), venture({})];
  d.ventures.push(...v, venture({ status: 'paused' }));
  d.worklogs.push(log({ venture_id: v[0].id, date: '2026-09-01' }));
  const f = runAudit(d, S, TODAY).filter((x) => x.rule === 'overload');
  assert.ok(f.some((x) => x.severity === 'high' && /3개/.test(x.title)));
  assert.ok(f.some((x) => /일째 작업 기록 없음/.test(x.title)));
});

test('idle upkeep, duplicates and satisfaction/value gap', () => {
  const d = emptyData();
  d.employees.push(
    employee({ name: 'idle', usage_frequency: 'rarely', contribution: 1, monthly_value: 0 }),
    employee({ name: 'ai1', overlap_group: 'AI', monthly_value: 50000, contribution: 5 }),
    employee({ name: 'ai2', overlap_group: 'AI', monthly_value: 5000, contribution: 3, satisfaction: 5 }),
  );
  const f = runAudit(d, S, TODAY);
  const idle = f.find((x) => x.rule === 'idle_cost' && /idle/.test(x.title));
  assert.equal(idle.severity, 'high');
  assert.ok(f.some((x) => x.rule === 'duplicate' && /2명/.test(x.title)));
  assert.ok(f.some((x) => x.rule === 'value_gap' && /ai2/.test(x.title)));
  assertWellFormed(f);
});

test('goal gaps: missed past goal and off-track current goal', () => {
  const d = emptyData();
  d.transactions.push(income('2026-10-10', 10), income('2026-11-02', 10));
  d.goals.push(goal({ period: '2026-10', target_value: 1000 }), goal({ period: '2026-11', target_value: 1000 }));
  const f = runAudit(d, S, TODAY).filter((x) => x.rule === 'goal_gap');
  assert.equal(f.length, 2);
  assert.ok(f.some((x) => x.basis === 'actual' && /미달/.test(x.title)));
  assert.ok(f.some((x) => x.basis === 'estimate' && /위험/.test(x.title)));
});

test('time waste: hours without revenue and logs without outputs', () => {
  const d = emptyData();
  const v = venture({ stage: 'launched' });
  d.ventures.push(v);
  for (let i = 1; i <= 10; i++) d.worklogs.push(log({ venture_id: v.id, date: `2026-11-${String(i).padStart(2, '0')}`, minutes: 150 }));
  const f = runAudit(d, S, TODAY).filter((x) => x.rule === 'time_waste');
  assert.ok(f.some((x) => /매출 0원/.test(x.title)));
  assert.ok(f.some((x) => /결과물 없음/.test(x.title)));
});

test('finance risk: losses, upkeep above revenue, reliance on non-revenue income, short runway', () => {
  const d = emptyData();
  d.accounts.push({ id: 1, balance: 1000, liquid: 1, as_of: TODAY });
  d.employees.push(employee({ monthly_cost: 5000, contribution: 5, monthly_value: 99999 }));
  for (const m of ['08', '09', '10']) {
    d.transactions.push(income(`2026-${m}-01`, 100), income(`2026-${m}-02`, 500, 'grant'), expense(`2026-${m}-03`, 2000));
  }
  const f = runAudit(d, S, TODAY).filter((x) => x.rule === 'finance_risk');
  const titles = f.map((x) => x.title).join('\n');
  assert.match(titles, /평균 적자/);
  assert.match(titles, /유지비보다 적음/);
  assert.match(titles, /매출 외 수입 의존/);
  assert.match(titles, /소진까지/);
  assertWellFormed(f);
});

test('findings are sorted by severity', () => {
  const d = emptyData();
  d.ventures.push(venture({ expected_monthly_revenue: 5, forecast_confidence: 'high' }));
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  const f = runAudit(d, S, TODAY);
  for (let i = 1; i < f.length; i++) assert.ok(order[f[i - 1].severity] <= order[f[i].severity]);
});
