// Pure calculations over a data snapshot from repository.loadData().
// Principles enforced here:
//  - only income_type = business_revenue counts as 매출
//  - 순이익 = 사업 매출 − 사업 비용; grants and personal income stay outside it
//  - expected (예상) figures are computed and returned apart from actual (실제) ones
//  - when inputs are missing the result is null / 'no_data', never a guess
import { USAGE } from './enums.js';
import { addDays, addMonths, inRange, monthOf, monthRange, periodInfo } from './dates.js';

export const sum = (rows, f) => rows.reduce((acc, r) => acc + (f(r) ?? 0), 0);
const round1 = (n) => Math.round(n * 10) / 10;

export const isRevenue = (t) => t.direction === 'income' && t.income_type === 'business_revenue';
export const isExpense = (t) => t.direction === 'expense';
export const isBizExpense = (t) => isExpense(t) && t.scope === 'business';

// ---------------------------------------------------------------- finance

export function totals(txs) {
  const income = { business_revenue: 0, grant: 0, living_support: 0, personal_other: 0, total: 0 };
  const expense = { total: 0, fixed: 0, variable: 0, business: 0, personal: 0, byClass: {} };
  for (const t of txs) {
    if (t.direction === 'income') {
      income[t.income_type] = (income[t.income_type] ?? 0) + t.amount;
      income.total += t.amount;
    } else {
      expense.total += t.amount;
      expense[t.cost_nature] += t.amount;
      expense[t.scope] += t.amount;
      expense.byClass[t.cost_class] = (expense.byClass[t.cost_class] ?? 0) + t.amount;
    }
  }
  return {
    income,
    expense,
    revenue: income.business_revenue,
    nonRevenueIncome: income.total - income.business_revenue,
    businessProfit: income.business_revenue - expense.business,
    net: income.total - expense.total,
    count: txs.length,
  };
}

export function txInRange(data, start, end) {
  return data.transactions.filter((t) => inRange(t.date, start, end));
}

export function monthTotals(data, month) {
  return totals(data.transactions.filter((t) => monthOf(t.date) === month));
}

export function cashflow(data, endMonth, count = 12) {
  return monthRange(endMonth, count).map((month) => ({ month, ...monthTotals(data, month) }));
}

export function assets(data) {
  const accounts = data.accounts;
  if (!accounts.length) return { total: null, available: null, count: 0, oldestAsOf: null, source: '등록된 계좌·자산 없음' };
  const asOfs = accounts.map((a) => a.as_of).sort();
  return {
    total: sum(accounts, (a) => a.balance),
    available: sum(accounts.filter((a) => a.liquid), (a) => a.balance),
    count: accounts.length,
    oldestAsOf: asOfs[0],
    newestAsOf: asOfs.at(-1),
    source: `계좌·자산 ${accounts.length}건의 사용자 입력 잔액 (기준일 ${asOfs[0]}${asOfs[0] !== asOfs.at(-1) ? ` ~ ${asOfs.at(-1)}` : ''})`,
  };
}

// Months with at least one transaction among the last `n` complete months.
export function recentCompleteMonths(data, today, n = 3) {
  const current = monthOf(today);
  return monthRange(addMonths(current, -1), n);
}

export function runway(data, today) {
  const a = assets(data);
  const months = recentCompleteMonths(data, today, 3);
  const rows = months.map((m) => monthTotals(data, m));
  const withData = rows.filter((r) => r.count > 0).length;
  if (a.available === null || withData === 0) {
    return { months: null, status: 'no_data', avgNet: null, basis: '가용자금 또는 최근 3개월 거래 기록이 없어 계산하지 않음' };
  }
  const avgNet = Math.round(sum(rows, (r) => r.net) / rows.length);
  const basis = `가용자금 ÷ 최근 3개월(${months[0]}~${months.at(-1)}) 평균 순현금흐름 ${avgNet.toLocaleString('ko-KR')}원. 과거 평균이 유지된다는 가정의 추정`;
  if (avgNet >= 0) return { months: null, status: 'positive', avgNet, basis };
  return { months: round1(a.available / -avgNet), status: 'burning', avgNet, basis };
}

// ---------------------------------------------------------------- employees

export function employeeStats(e) {
  const amortization = e.purchase_price && e.useful_life_months ? Math.round(e.purchase_price / e.useful_life_months) : 0;
  const effectiveCost = e.monthly_cost + amortization;
  const valueRatio = e.monthly_value === null || e.monthly_value === undefined || effectiveCost === 0 ? null : round1(e.monthly_value / effectiveCost);
  const active = e.status !== 'terminated';
  const reasons = [];
  const missing = [];
  if (e.usage_frequency === 'rarely' || e.usage_frequency === 'never') reasons.push(`사용 빈도 '${USAGE[e.usage_frequency]}'`);
  if (e.contribution !== null && e.contribution <= 2) reasons.push(`업무 기여도 ${e.contribution}/5`);
  if (valueRatio !== null && valueRatio < 1) reasons.push(`추정 효용이 비용의 ${Math.round(valueRatio * 100)}%`);
  if (e.contribution === null) missing.push('업무 기여도');
  if (e.monthly_value === null) missing.push('경제적 효용');
  const satisfactionGap = e.satisfaction !== null && e.satisfaction >= 4 && valueRatio !== null && valueRatio < 1;

  let recommendation;
  if (!active) recommendation = 'terminated';
  else if (effectiveCost > 0 && reasons.length >= 2) recommendation = 'cancel';
  else if (effectiveCost > 0 && reasons.length === 1) recommendation = 'review';
  else if (missing.length) recommendation = 'evaluate';
  else recommendation = 'keep';
  return { amortization, effectiveCost, valueRatio, active, reasons, missing, satisfactionGap, recommendation };
}

export const RECOMMENDATION_LABELS = {
  keep: '유지 적정',
  evaluate: '평가 데이터 필요',
  review: '검토 권장',
  cancel: '해지 권고',
  terminated: '해지 완료',
};

export function employeesAnalysis(data) {
  const rows = data.employees.map((e) => ({ ...e, stats: employeeStats(e) }));
  const active = rows.filter((r) => r.stats.active);
  const byDepartment = {};
  for (const r of active) {
    const d = (byDepartment[r.department] ??= { count: 0, cost: 0 });
    d.count++;
    d.cost += r.stats.effectiveCost;
  }
  const groups = {};
  for (const r of active) {
    const g = r.overlap_group.trim();
    if (g) (groups[g] ??= []).push(r);
  }
  const overlaps = Object.entries(groups)
    .filter(([, members]) => members.length > 1)
    .map(([group, members]) => ({ group, members, cost: sum(members, (m) => m.stats.effectiveCost) }));
  return {
    rows,
    totals: {
      activeCount: active.length,
      monthlyCost: sum(active, (r) => r.monthly_cost),
      amortization: sum(active, (r) => r.stats.amortization),
      effectiveCost: sum(active, (r) => r.stats.effectiveCost),
      valuedCount: active.filter((r) => r.monthly_value !== null).length,
      flaggedCost: sum(active.filter((r) => ['review', 'cancel'].includes(r.stats.recommendation)), (r) => r.stats.effectiveCost),
    },
    byDepartment,
    overlaps,
  };
}

// ---------------------------------------------------------------- ventures

export function ventureAnalysis(data, today, settings = {}) {
  const hourly = settings.hourly_value ?? 0;
  const lastMonths = recentCompleteMonths(data, today, 3);
  const series = monthRange(monthOf(today), 6);
  return data.ventures.map((v) => {
    const txs = data.transactions.filter((t) => t.venture_id === v.id);
    const logs = data.worklogs.filter((l) => l.venture_id === v.id);
    const revenue = sum(txs.filter(isRevenue), (t) => t.amount);
    const cost = sum(txs.filter(isExpense), (t) => t.amount);
    const otherIncome = sum(txs.filter((t) => t.direction === 'income' && !isRevenue(t)), (t) => t.amount);
    const minutes = sum(logs, (l) => l.minutes);
    const hours = round1(minutes / 60);
    const recentRevenue = lastMonths.map((m) => sum(txs.filter((t) => isRevenue(t) && monthOf(t.date) === m), (t) => t.amount));
    const avgRecentRevenue = Math.round(sum(recentRevenue, (x) => x) / lastMonths.length);
    const expected = v.expected_monthly_revenue;
    const lastWork = logs.map((l) => l.date).sort().at(-1) ?? null;
    return {
      ...v,
      actual: {
        revenue,
        cost,
        profit: revenue - cost,
        otherIncome,
        minutes,
        hours,
        revenuePerHour: minutes > 0 ? Math.round(revenue / (minutes / 60)) : null,
        avgRecentRevenue,
        recentMonths: lastMonths,
        outputs: logs.filter((l) => l.output.trim()).length,
        lastWork,
        txCount: txs.length,
        logCount: logs.length,
        monthly: series.map((m) => ({
          month: m,
          revenue: sum(txs.filter((t) => isRevenue(t) && monthOf(t.date) === m), (t) => t.amount),
          cost: sum(txs.filter((t) => isExpense(t) && monthOf(t.date) === m), (t) => t.amount),
        })),
      },
      expected: {
        monthlyRevenue: expected,
        basis: v.forecast_basis,
        confidence: v.forecast_confidence,
        // How many times the forecast exceeds what has actually been earned recently.
        vsRecentActual: expected && avgRecentRevenue > 0 ? round1(expected / avgRecentRevenue) : null,
      },
      estimate: {
        timeCost: hourly > 0 ? Math.round((minutes / 60) * hourly) : null,
        profitAfterTime: hourly > 0 ? revenue - cost - Math.round((minutes / 60) * hourly) : null,
        hourlyValue: hourly,
      },
    };
  });
}

// ---------------------------------------------------------------- goals

const LOWER_IS_BETTER = new Set(['expense_cap']);

function goalActual(goal, data, start, end) {
  const scoped = (t) => (goal.venture_id ? t.venture_id === goal.venture_id : true);
  const txs = txInRange(data, start, end).filter(scoped);
  const logs = data.worklogs.filter((l) => inRange(l.date, start, end) && scoped(l));
  const rangeText = `${start}~${end}${goal.venture_id ? `, 사업 #${goal.venture_id}` : ''}`;
  switch (goal.metric) {
    case 'business_revenue': {
      const rows = txs.filter(isRevenue);
      return { value: sum(rows, (t) => t.amount), records: rows.length, source: `수입·지출: 사업 매출 ${rows.length}건 (${rangeText})` };
    }
    case 'net_profit': {
      const rev = txs.filter(isRevenue);
      const exp = txs.filter(goal.venture_id ? isExpense : isBizExpense);
      return {
        value: sum(rev, (t) => t.amount) - sum(exp, (t) => t.amount),
        records: rev.length + exp.length,
        source: `수입·지출: 사업 매출 ${rev.length}건 − 사업 비용 ${exp.length}건 (${rangeText})`,
      };
    }
    case 'expense_cap': {
      const rows = txs.filter(isExpense);
      return { value: sum(rows, (t) => t.amount), records: rows.length, source: `수입·지출: 지출 ${rows.length}건 (${rangeText})` };
    }
    case 'work_hours':
      return { value: round1(sum(logs, (l) => l.minutes) / 60), records: logs.length, source: `업무 기록 ${logs.length}건의 실제 작업 시간 (${rangeText})` };
    case 'outputs': {
      const rows = logs.filter((l) => l.output.trim());
      return { value: rows.length, records: rows.length, source: `결과물이 기록된 업무 ${rows.length}건 (${rangeText})` };
    }
    default:
      return {
        value: goal.manual_actual,
        records: goal.manual_actual === null ? 0 : 1,
        source: goal.manual_actual === null ? '실제값 미입력' : '사용자가 직접 입력한 실제값',
      };
  }
}

export function goalAnalysis(goal, data, today) {
  const p = periodInfo(goal.period_type, goal.period, today);
  const actual = goalActual(goal, data, p.start, p.phase === 'current' ? today : p.end);
  const lower = LOWER_IS_BETTER.has(goal.metric);
  const target = goal.target_value;
  const hasData = actual.records > 0 && actual.value !== null;
  const meets = (v) => (lower ? v <= target : v >= target);

  let expected = null;
  let expectedBasis = null;
  if (p.phase === 'current' && goal.metric !== 'custom' && hasData) {
    expected = Math.round((actual.value / p.fraction) * 10) / 10;
    if (goal.metric !== 'work_hours') expected = Math.round(expected);
    expectedBasis = `실제 ${actual.value.toLocaleString('ko-KR')} ÷ 경과 비율 ${p.elapsed}/${p.total}일. 지금 속도가 유지된다는 단순 선형 추정`;
  } else if (goal.metric === 'custom') {
    expectedBasis = '직접 입력 지표는 추정하지 않음';
  } else if (!hasData && p.phase === 'current') {
    expectedBasis = '실적 데이터가 없어 추정하지 않음';
  }

  let status;
  if (p.phase === 'future') status = 'not_started';
  else if (!hasData) status = 'no_data';
  else if (p.phase === 'past') status = meets(actual.value) ? 'achieved' : 'missed';
  else if (!lower && actual.value >= target) status = 'achieved';
  else if (lower && actual.value > target) status = 'missed';
  else if (expected === null) status = 'in_progress';
  else if (meets(expected)) status = 'on_track';
  else if (lower ? expected <= target * 1.1 : expected >= target * 0.8) status = 'at_risk';
  else status = 'off_track';

  const remainingDays = p.total - p.elapsed;
  const gap = actual.value === null ? null : target - actual.value;
  const plans = data.plans.filter((x) => x.goal_id === goal.id);
  const logs = data.worklogs.filter((l) => l.goal_id === goal.id);
  return {
    ...goal,
    period: goal.period,
    info: p,
    target,
    actual: actual.value,
    actualSource: actual.source,
    hasData,
    expected,
    expectedBasis,
    status,
    lowerIsBetter: lower,
    gap,
    progress: hasData && target > 0 ? Math.round((actual.value / target) * 1000) / 10 : null,
    neededPerDay: !lower && goal.metric !== 'custom' && p.phase === 'current' && gap > 0 && remainingDays > 0 ? Math.ceil(gap / remainingDays) : null,
    plans: {
      total: plans.length,
      done: plans.filter((x) => x.status === 'done').length,
      dropped: plans.filter((x) => x.status === 'dropped').length,
      overdue: plans.filter((x) => x.due_date && x.due_date < today && !['done', 'dropped'].includes(x.status)).length,
      plannedMinutes: sum(plans, (x) => x.planned_minutes),
      actualMinutes: sum(logs, (l) => l.minutes),
    },
  };
}

export const GOAL_STATUS_LABELS = {
  achieved: '달성',
  missed: '미달',
  on_track: '순항',
  at_risk: '주의',
  off_track: '위험',
  in_progress: '진행 중',
  not_started: '시작 전',
  no_data: '데이터 없음',
};

export function goalsAnalysis(data, today) {
  return data.goals.map((g) => goalAnalysis(g, data, today));
}

// ---------------------------------------------------------------- productivity

export function productivity(data, today, days = 30) {
  const start = addDays(today, -(days - 1));
  const prevStart = addDays(start, -days);
  const prevEnd = addDays(start, -1);
  const logs = data.worklogs.filter((l) => inRange(l.date, start, today));
  const prevLogs = data.worklogs.filter((l) => inRange(l.date, prevStart, prevEnd));
  const revenueTx = txInRange(data, start, today).filter(isRevenue);
  const minutes = sum(logs, (l) => l.minutes);
  const withOutput = logs.filter((l) => l.output.trim());

  const ventureNames = new Map(data.ventures.map((v) => [v.id, v.name]));
  const byVenture = new Map();
  for (const l of logs) {
    const key = l.venture_id ?? 0;
    const row = byVenture.get(key) ?? { venture_id: l.venture_id, name: ventureNames.get(l.venture_id) ?? '사업 미지정', minutes: 0, logs: 0, outputs: 0, revenue: 0 };
    row.minutes += l.minutes;
    row.logs++;
    if (l.output.trim()) row.outputs++;
    byVenture.set(key, row);
  }
  for (const t of revenueTx) {
    const row = byVenture.get(t.venture_id ?? 0);
    if (row) row.revenue += t.amount;
  }
  const ventures = [...byVenture.values()]
    .map((r) => ({ ...r, hours: round1(r.minutes / 60), revenuePerHour: r.minutes ? Math.round(r.revenue / (r.minutes / 60)) : null }))
    .sort((a, b) => b.minutes - a.minutes);

  const byCategory = {};
  for (const l of logs) byCategory[l.category] = (byCategory[l.category] ?? 0) + l.minutes;

  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return { date, minutes: sum(logs.filter((l) => l.date === date), (l) => l.minutes) };
  });
  const activeDays = daily.filter((d) => d.minutes > 0).length;
  const revenue = sum(revenueTx, (t) => t.amount);

  return {
    range: { start, end: today, days },
    minutes,
    hours: round1(minutes / 60),
    prevHours: round1(sum(prevLogs, (l) => l.minutes) / 60),
    logs: logs.length,
    outputs: withOutput.length,
    outputRate: logs.length ? Math.round((withOutput.length / logs.length) * 100) : null,
    activeDays,
    avgHoursPerActiveDay: activeDays ? round1(minutes / 60 / activeDays) : null,
    revenue,
    revenuePerHour: minutes ? Math.round(revenue / (minutes / 60)) : null,
    ventures,
    byCategory,
    daily,
    source: `업무 기록 ${logs.length}건, 사업 매출 ${revenueTx.length}건 (${start}~${today}). 시간당 매출은 같은 기간의 매출÷시간이며 인과관계를 뜻하지 않음`,
  };
}
