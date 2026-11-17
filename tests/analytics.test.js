import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  employeeStats,
  employeesAnalysis,
  goalAnalysis,
  monthTotals,
  productivity,
  runway,
  ventureAnalysis,
} from '../src/core/analytics.js';
import { emptyData, employee, expense, goal, income, log, venture } from './helpers.js';

const TODAY = '2026-11-15'; // half of November

test('only business revenue counts as 매출; profit excludes grants and personal costs', () => {
  const d = emptyData();
  d.transactions.push(
    income('2026-11-01', 1000),
    income('2026-11-02', 5000, 'grant'),
    income('2026-11-03', 300, 'living_support'),
    income('2026-11-03', 200, 'personal_other'),
    expense('2026-11-04', 400),
    expense('2026-11-05', 700, { scope: 'personal', cost_class: 'living', cost_nature: 'fixed' }),
  );
  const t = monthTotals(d, '2026-11');
  assert.equal(t.revenue, 1000);
  assert.equal(t.nonRevenueIncome, 5500);
  assert.equal(t.businessProfit, 600); // 1000 − 400
  assert.equal(t.net, 6500 - 1100);
  assert.equal(t.expense.fixed, 700);
  assert.equal(t.expense.variable, 400);
});

test('expected venture revenue never enters actual figures', () => {
  const d = emptyData();
  const v = venture({ expected_monthly_revenue: 9_000_000, forecast_confidence: 'high', forecast_basis: 'x' });
  d.ventures.push(v);
  d.transactions.push(income('2026-10-10', 100, 'business_revenue', { venture_id: v.id }));
  const [a] = ventureAnalysis(d, TODAY);
  assert.equal(a.actual.revenue, 100);
  assert.equal(a.expected.monthlyRevenue, 9_000_000);
  assert.equal(monthTotals(d, '2026-11').revenue, 0);
});

test('venture: cost, profit, hours, revenue per hour, recent average, time cost estimate', () => {
  const d = emptyData();
  const v = venture({ expected_monthly_revenue: 3000, forecast_confidence: 'low' });
  d.ventures.push(v);
  d.transactions.push(
    income('2026-08-05', 600, 'business_revenue', { venture_id: v.id }),
    income('2026-10-05', 300, 'business_revenue', { venture_id: v.id }),
    income('2026-10-06', 999, 'grant', { venture_id: v.id }),
    expense('2026-10-07', 200, { venture_id: v.id }),
  );
  d.worklogs.push(log({ venture_id: v.id, minutes: 120, date: '2026-10-01', output: 'x' }), log({ venture_id: v.id, minutes: 60, date: '2026-11-01' }));
  const [a] = ventureAnalysis(d, TODAY, { hourly_value: 100 });
  assert.equal(a.actual.revenue, 900);
  assert.equal(a.actual.otherIncome, 999);
  assert.equal(a.actual.cost, 200);
  assert.equal(a.actual.profit, 700);
  assert.equal(a.actual.hours, 3);
  assert.equal(a.actual.revenuePerHour, 300);
  assert.equal(a.actual.avgRecentRevenue, 300); // (600 + 0 + 300) / 3 over Aug–Oct
  assert.equal(a.expected.vsRecentActual, 10);
  assert.equal(a.estimate.timeCost, 300);
  assert.equal(a.estimate.profitAfterTime, 400);
  assert.equal(a.actual.outputs, 1);
});

test('goal: on track / off track by linear projection, labelled as expected', () => {
  const d = emptyData();
  d.transactions.push(income('2026-11-10', 600));
  const days = 15 / 30;
  const onTrack = goalAnalysis(goal({ target_value: 1000 }), d, TODAY);
  assert.equal(onTrack.actual, 600);
  assert.equal(onTrack.expected, Math.round(600 / days));
  assert.equal(onTrack.status, 'on_track');
  assert.match(onTrack.expectedBasis, /선형 추정/);
  assert.equal(goalAnalysis(goal({ target_value: 1400 }), d, TODAY).status, 'at_risk');
  assert.equal(goalAnalysis(goal({ target_value: 5000 }), d, TODAY).status, 'off_track');
  assert.equal(goalAnalysis(goal({ target_value: 500 }), d, TODAY).status, 'achieved');
});

test('goal: no data is reported as no_data, not as failure or a guess', () => {
  const d = emptyData();
  const g = goalAnalysis(goal({ target_value: 1000 }), d, TODAY);
  assert.equal(g.status, 'no_data');
  assert.equal(g.expected, null);
  assert.equal(g.progress, null);
  const past = goalAnalysis(goal({ period: '2026-09' }), d, TODAY);
  assert.equal(past.status, 'no_data');
  const custom = goalAnalysis(goal({ metric: 'custom', manual_actual: null }), d, TODAY);
  assert.equal(custom.status, 'no_data');
});

test('goal: past periods are achieved/missed; future not started; custom never projected', () => {
  const d = emptyData();
  d.transactions.push(income('2026-09-10', 50));
  assert.equal(goalAnalysis(goal({ period: '2026-09', target_value: 100 }), d, TODAY).status, 'missed');
  assert.equal(goalAnalysis(goal({ period: '2026-09', target_value: 50 }), d, TODAY).status, 'achieved');
  assert.equal(goalAnalysis(goal({ period: '2026-12' }), d, TODAY).status, 'not_started');
  const c = goalAnalysis(goal({ metric: 'custom', manual_actual: 30, target_value: 50 }), d, TODAY);
  assert.equal(c.status, 'in_progress');
  assert.equal(c.expected, null);
});

test('goal: expense cap is lower-is-better', () => {
  const d = emptyData();
  d.transactions.push(expense('2026-11-03', 400));
  assert.equal(goalAnalysis(goal({ metric: 'expense_cap', target_value: 1000 }), d, TODAY).status, 'on_track');
  assert.equal(goalAnalysis(goal({ metric: 'expense_cap', target_value: 700 }), d, TODAY).status, 'off_track');
  assert.equal(goalAnalysis(goal({ metric: 'expense_cap', target_value: 300 }), d, TODAY).status, 'missed');
});

test('goal: plans and work linked to the goal are summarised', () => {
  const d = emptyData();
  const g = goal({ metric: 'work_hours', target_value: 10 });
  d.plans.push({ id: 1, goal_id: g.id, title: 'a', status: 'done', due_date: '2026-11-01', planned_minutes: 60 }, { id: 2, goal_id: g.id, title: 'b', status: 'todo', due_date: '2026-11-10', planned_minutes: 30 });
  d.worklogs.push(log({ goal_id: g.id, date: '2026-11-02', minutes: 90 }));
  const a = goalAnalysis(g, d, TODAY);
  assert.equal(a.actual, 1.5);
  assert.deepEqual({ ...a.plans }, { total: 2, done: 1, dropped: 0, overdue: 1, plannedMinutes: 90, actualMinutes: 90 });
});

test('employee: amortization, value ratio, and recommendations keep satisfaction separate', () => {
  const laptop = employeeStats(employee({ monthly_cost: 0, purchase_price: 1200, useful_life_months: 12, monthly_value: 300, contribution: 5 }));
  assert.equal(laptop.amortization, 100);
  assert.equal(laptop.effectiveCost, 100);
  assert.equal(laptop.valueRatio, 3);
  assert.equal(laptop.recommendation, 'keep');

  const liked = employeeStats(employee({ monthly_cost: 1000, monthly_value: 200, contribution: 4, satisfaction: 5 }));
  assert.equal(liked.recommendation, 'review');
  assert.equal(liked.satisfactionGap, true);

  const idle = employeeStats(employee({ monthly_cost: 1000, usage_frequency: 'never', contribution: 1, monthly_value: 0 }));
  assert.equal(idle.recommendation, 'cancel');
  assert.equal(idle.reasons.length, 3);

  const unknown = employeeStats(employee({ monthly_cost: 1000 }));
  assert.equal(unknown.recommendation, 'evaluate');
  assert.equal(unknown.valueRatio, null);

  assert.equal(employeeStats(employee({ status: 'terminated', usage_frequency: 'never' })).recommendation, 'terminated');
});

test('employees: overlap groups only count active members', () => {
  const d = emptyData();
  d.employees.push(employee({ overlap_group: 'AI' }), employee({ overlap_group: 'AI' }), employee({ overlap_group: 'AI', status: 'terminated' }), employee({ overlap_group: 'X' }));
  const a = employeesAnalysis(d);
  assert.equal(a.overlaps.length, 1);
  assert.equal(a.overlaps[0].members.length, 2);
  assert.equal(a.totals.activeCount, 3);
  assert.equal(a.totals.monthlyCost, 30000);
});

test('runway: needs both balances and history; reports burning months', () => {
  const d = emptyData();
  assert.equal(runway(d, TODAY).status, 'no_data');
  d.accounts.push({ id: 1, balance: 3000, liquid: 1, as_of: TODAY }, { id: 2, balance: 9999, liquid: 0, as_of: TODAY });
  assert.equal(runway(d, TODAY).status, 'no_data');
  d.transactions.push(expense('2026-08-01', 1000), expense('2026-09-01', 1000), expense('2026-10-01', 1000));
  const r = runway(d, TODAY);
  assert.equal(r.status, 'burning');
  assert.equal(r.months, 3);
  d.transactions.push(income('2026-10-02', 5000));
  assert.equal(runway(d, TODAY).status, 'positive');
});

test('productivity: hours, output rate, revenue per hour, daily series', () => {
  const d = emptyData();
  const v = venture({});
  d.ventures.push(v);
  d.worklogs.push(
    log({ date: '2026-11-15', minutes: 120, venture_id: v.id, output: 'done' }),
    log({ date: '2026-11-14', minutes: 60, category: 'admin' }),
    log({ date: '2026-10-01', minutes: 600 }), // outside 30 days
  );
  d.transactions.push(income('2026-11-10', 3000, 'business_revenue', { venture_id: v.id }));
  const p = productivity(d, TODAY, 30);
  assert.equal(p.hours, 3);
  assert.equal(p.outputRate, 50);
  assert.equal(p.revenuePerHour, 1000);
  assert.equal(p.daily.length, 30);
  assert.equal(p.daily.at(-1).minutes, 120);
  assert.equal(p.ventures.find((x) => x.venture_id === v.id).revenuePerHour, 1500);
  assert.equal(p.byCategory.admin, 60);
});
