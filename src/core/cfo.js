// CFO agent: turns a finance request into a structured report.
// It only uses the calculations this app already trusts (analytics.js, audit.js).
// Missing inputs stay null and are listed under `limitations`; nothing is guessed.
// Results hold aggregates only: no account names, account notes, or ledger rows,
// so what leaves this app for another application is a report, not the books.
import { addMonths, daysBetween, monthOf } from './dates.js';
import { assets, cashflow, goalsAnalysis, GOAL_STATUS_LABELS, isRevenue, monthTotals, runway, sum } from './analytics.js';
import { runAudit } from './audit.js';

export const CFO_KINDS = Object.freeze({
  monthly_report: '월간 재무 보고서',
  financial_analysis: '사업 손익 분석',
  cash_flow: '현금흐름·자금 소진 점검',
  bookkeeping: '장부 정리 현황',
  tax_summary: '세무 준비 자료',
  portfolio: '투자 자산 현황',
  planning: '재무 계획·권고',
  risk_audit: '재무 위험 점검',
});

// Used only when a request does not name a kind. Order matters: the first match wins.
const KEYWORDS = [
  ['tax_summary', /세금|세무|부가세|종합소득|연말정산|\btax/i],
  ['portfolio', /투자|주식|포트폴리오|펀드|\bportfolio|\bstock/i],
  ['cash_flow', /현금|자금|런웨이|소진|\bcash|\brunway/i],
  ['bookkeeping', /장부|기장|분류|누락|\bbookkeep/i],
  ['risk_audit', /감사|위험|리스크|\baudit|\brisk/i],
  ['planning', /계획|목표|권고|예산|\bplan|\bbudget|\bgoal/i],
  ['financial_analysis', /손익|분석|수익성|\banalysis|\bprofit/i],
  ['monthly_report', /월간|보고서|리포트|\breport|\bmonthly/i],
];

export function inferKind(text = '') {
  for (const [kind, pattern] of KEYWORDS) if (pattern.test(text)) return kind;
  return 'monthly_report';
}

const figure = (label, value, unit = '원', basis = '') => ({ label, value: value ?? null, unit, basis });
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

export function formatValue(f) {
  if (f.value === null || f.value === undefined) return '데이터 없음';
  if (typeof f.value === 'string') return f.value;
  if (f.unit === '%') return `${f.value}%`;
  if (f.unit === '원') return `${Math.round(f.value).toLocaleString('ko-KR')}원`;
  return `${f.value.toLocaleString('ko-KR')}${f.unit ?? ''}`;
}

const finding = (severity, title, detail = '', recommendation = '') => ({ severity, title, detail, recommendation });

/* Each builder returns { figures, findings, recommendations, limitations, breakdown? }. */
const BUILDERS = {
  monthly_report({ data, settings, today, month }) {
    const cur = monthTotals(data, month);
    const prev = monthTotals(data, addMonths(month, -1));
    const has = cur.count > 0;
    const figures = [
      figure('사업 매출', has ? cur.revenue : null, '원', `${month} 거래 중 사업 매출`),
      figure('사업 비용', has ? cur.expense.business : null, '원', `${month} 거래 중 사업 비용`),
      figure('사업 순이익', has ? cur.businessProfit : null, '원', '사업 매출 − 사업 비용'),
      figure('매출 외 수입', has ? cur.nonRevenueIncome : null, '원', '지원금·생활비 지원·기타 개인 수입'),
      figure('개인 비용', has ? cur.expense.personal : null, '원', '사업 비용이 아닌 지출'),
      figure('인건비', has ? (cur.expense.byClass.labor ?? 0) : null, '원', '비용 분류 인건비'),
      figure('제품·서비스 유지비', has ? (cur.expense.byClass.product_service ?? 0) : null, '원', '비용 분류 제품·서비스 유지비'),
      figure('전월 대비 매출 증감', prev.revenue && has ? pct(cur.revenue - prev.revenue, prev.revenue) : null, '%', `${addMonths(month, -1)} 대비`),
    ];
    const findings = runAudit(data, settings, today)
      .filter((f) => f.severity === 'high' || f.severity === 'medium')
      .slice(0, 5)
      .map((f) => finding(f.severity, f.title, f.detail, f.recommendation));
    const limitations = [];
    if (!has) limitations.push(`${month}에 기록된 거래가 없습니다.`);
    if (!data.accounts.length) limitations.push('계좌·자산 잔액이 없어 가용자금은 계산하지 않았습니다.');
    return { figures, findings, recommendations: findings.map((f) => f.recommendation).filter(Boolean).slice(0, 3), limitations };
  },

  financial_analysis({ data, month }) {
    const rows = cashflow(data, month, 3);
    const months = rows.map((r) => r.month);
    const withData = rows.filter((r) => r.count > 0).length;
    const rev = sum(rows, (r) => r.revenue);
    const profit = sum(rows, (r) => r.businessProfit);
    const has = withData > 0;
    const inWindow = (t) => months.includes(monthOf(t.date));
    const breakdown = data.ventures.map((v) => {
      const txs = data.transactions.filter((t) => t.venture_id === v.id && inWindow(t));
      const revenue = sum(txs.filter(isRevenue), (t) => t.amount);
      const cost = sum(txs.filter((t) => t.direction === 'expense' && t.scope === 'business'), (t) => t.amount);
      return { name: v.name, status: v.status, revenue, cost, profit: revenue - cost };
    });
    const findings = breakdown
      .filter((b) => b.status === 'active' && b.revenue + b.cost > 0 && b.profit < 0)
      .map((b) => finding('medium', `${b.name} 적자`, `최근 3개월 사업 비용이 매출보다 큽니다.`, '비용 구조와 가격을 점검하세요.'));
    return {
      figures: [
        figure('최근 3개월 사업 매출', has ? rev : null, '원', `${months[0]} ~ ${month}`),
        figure('최근 3개월 사업 순이익', has ? profit : null, '원', '사업 매출 − 사업 비용'),
        figure('사업 순이익률', has ? pct(profit, rev) : null, '%', '순이익 ÷ 매출'),
      ],
      findings,
      recommendations: findings.length ? ['적자 사업의 비용 구조를 먼저 점검하세요.'] : [],
      limitations: has ? [] : ['최근 3개월 거래 기록이 없습니다.'],
      breakdown,
    };
  },

  cash_flow({ data, today }) {
    const a = assets(data);
    const r = runway(data, today);
    const findings = [];
    if (r.status === 'burning' && r.months !== null) {
      findings.push(finding('high', '자금 소진 가능성', `현재 흐름이 유지되면 약 ${r.months}개월 뒤 가용자금이 바닥납니다(추정).`, '고정비를 줄이거나 매출 확보 계획을 세우세요.'));
    }
    return {
      figures: [
        figure('가용자금', a.available, '원', a.source),
        figure('최근 3개월 평균 순현금흐름', r.avgNet, '원', r.basis),
        figure('자금 소진 예상', r.status === 'burning' ? r.months : null, '개월', '추정치'),
      ],
      findings,
      recommendations: r.status === 'positive' ? ['현재 현금흐름은 플러스입니다. 흐름을 유지하세요.'] : findings.length ? ['3개월 이상의 비상 자금 확보를 계획하세요.'] : [],
      limitations: r.status === 'no_data' ? [r.basis] : [],
    };
  },

  bookkeeping({ data, today, month }) {
    const inM = data.transactions.filter((t) => monthOf(t.date) === month);
    const count = (fn) => inM.filter(fn).length;
    const gaps = {
      revenueWithoutVenture: count((t) => isRevenue(t) && !t.venture_id),
      expenseWithoutVenture: count((t) => t.direction === 'expense' && t.scope === 'business' && !t.venture_id),
      withoutDescription: count((t) => !String(t.description ?? '').trim()),
      staleAccounts: data.accounts.filter((a) => daysBetween(a.as_of, today) > 30).length,
    };
    const findings = [];
    if (gaps.revenueWithoutVenture) findings.push(finding('medium', '사업 매출이 사업과 연결되지 않음', `${gaps.revenueWithoutVenture}건`, '매출을 해당 사업에 연결하세요.'));
    if (gaps.expenseWithoutVenture) findings.push(finding('low', '사업 비용이 사업과 연결되지 않음', `${gaps.expenseWithoutVenture}건`, '비용을 해당 사업에 연결하세요.'));
    if (gaps.staleAccounts) findings.push(finding('medium', '잔액 기준일이 오래된 계좌', `${gaps.staleAccounts}개 계좌가 30일 넘게 갱신되지 않았습니다.`, '계좌 잔액을 최신으로 갱신하세요.'));
    return {
      figures: [
        figure('거래 건수', inM.length, '건', `${month} 기준`),
        figure('사업 매출 — 사업 미연결', gaps.revenueWithoutVenture, '건'),
        figure('사업 비용 — 사업 미연결', gaps.expenseWithoutVenture, '건'),
        figure('설명 없는 거래', gaps.withoutDescription, '건'),
        figure('30일 넘게 미갱신 계좌', gaps.staleAccounts, '개'),
      ],
      findings,
      recommendations: findings.map((f) => f.recommendation),
      limitations: inM.length ? [] : [`${month}에 기록된 거래가 없습니다.`],
    };
  },

  tax_summary({ data, month }) {
    const year = month.slice(0, 4);
    const txs = data.transactions.filter((t) => t.date.startsWith(year));
    const incomeOf = (type) => sum(txs.filter((t) => t.direction === 'income' && t.income_type === type), (t) => t.amount);
    const bizExpense = txs.filter((t) => t.direction === 'expense' && t.scope === 'business');
    const byClass = (cls) => sum(bizExpense.filter((t) => t.cost_class === cls), (t) => t.amount);
    const has = txs.length > 0;
    return {
      figures: [
        figure(`${year}년 사업 매출`, has ? incomeOf('business_revenue') : null, '원'),
        figure(`${year}년 지원금 (정부·기관)`, has ? incomeOf('grant') : null, '원'),
        figure(`${year}년 생활비 지원`, has ? incomeOf('living_support') : null, '원'),
        figure(`${year}년 기타 개인 수입`, has ? incomeOf('personal_other') : null, '원'),
        figure(`${year}년 사업 비용 합계`, has ? sum(bizExpense, (t) => t.amount) : null, '원'),
        figure('인건비', has ? byClass('labor') : null, '원'),
        figure('제품·서비스 유지비', has ? byClass('product_service') : null, '원'),
        figure('세금·공과금', has ? byClass('tax') : null, '원'),
      ],
      findings: [],
      recommendations: ['세무 신고 전에 증빙 원본과 대조하세요.'],
      limitations: [
        '세무 신고 대행이 아니며 공제·세율 판단은 세무사 검토가 필요합니다.',
        has ? '사업 비용 중 공제 가능 여부는 이 앱이 판단하지 않습니다.' : `${year}년 거래 기록이 없습니다.`,
      ],
    };
  },

  portfolio({ data, today }) {
    const inv = data.accounts.filter((a) => a.kind === 'investment');
    const debts = data.accounts.filter((a) => a.kind === 'debt');
    const total = sum(data.accounts, (a) => a.balance);
    const asOfs = inv.map((a) => a.as_of).sort();
    const oldest = asOfs[0] ?? null;
    const findings = [];
    if (oldest && daysBetween(oldest, today) > 30) {
      findings.push(finding('medium', '투자 잔액 기준일이 오래됨', `가장 오래된 기준일 ${oldest}.`, '시장 가치에 맞춰 투자 잔액을 갱신하세요.'));
    }
    return {
      figures: [
        figure('투자 자산 합계 (입력 잔액)', inv.length ? sum(inv, (a) => a.balance) : null, '원', '사용자가 입력한 잔액 기준'),
        figure('투자 계좌·자산 수', inv.length, '개'),
        figure('부채 합계', debts.length ? Math.abs(sum(debts, (a) => a.balance)) : null, '원'),
        figure('순자산 (전체 잔액 합)', data.accounts.length ? total : null, '원'),
        figure('가장 오래된 투자 기준일', oldest, ''),
      ],
      findings,
      recommendations: findings.length ? ['투자 잔액을 최신 시장 가치로 갱신하세요.'] : [],
      limitations: ['시세를 조회하지 않습니다. 종목별 보유 내역이 아니라 계좌·자산 단위 잔액만 집계합니다.'],
    };
  },

  planning({ data, today, month }) {
    const r = runway(data, today);
    const goals = goalsAnalysis(data, today).filter((g) => g.period === month || g.period === month.slice(0, 4));
    const onTrack = goals.filter((g) => ['achieved', 'on_track', 'in_progress'].includes(g.status)).length;
    const findings = goals
      .filter((g) => ['missed', 'off_track', 'at_risk'].includes(g.status))
      .map((g) => finding('medium', `목표 '${g.title}' ${GOAL_STATUS_LABELS[g.status]}`, `목표 ${g.target}, 실제 ${g.actual ?? '—'}.`, '실행 계획을 다시 짜세요.'));
    const recommendations = [...findings.map((f) => f.recommendation)];
    if (r.status === 'burning') recommendations.push('3개월 이상의 생활·운영비를 비상 자금으로 확보하세요.');
    return {
      figures: [
        figure('자금 소진 예상', r.status === 'burning' ? r.months : null, '개월', '추정치'),
        figure('이번 기간 목표', goals.length, '건'),
        figure('순항·달성 목표', goals.length ? onTrack : null, '건'),
      ],
      findings,
      recommendations: [...new Set(recommendations)],
      limitations: goals.length ? [] : ['이번 기간에 등록된 목표가 없습니다.'],
    };
  },

  risk_audit({ data, settings, today }) {
    const all = runAudit(data, settings, today);
    const findings = all
      .filter((f) => f.severity === 'high' || f.severity === 'medium')
      .map((f) => finding(f.severity, f.title, f.detail, f.recommendation));
    return {
      figures: [
        figure('높음 위험', findings.filter((f) => f.severity === 'high').length, '건'),
        figure('보통 위험', findings.filter((f) => f.severity === 'medium').length, '건'),
        figure('점검 항목 전체', all.length, '건'),
      ],
      findings,
      recommendations: findings.map((f) => f.recommendation).filter(Boolean).slice(0, 5),
      limitations: data.transactions.length || data.accounts.length ? [] : ['점검할 기록이 없습니다.'],
    };
  },
};

/**
 * Runs one CFO task. `kind` must be a key of CFO_KINDS; `month` is YYYY-MM.
 * Returns { summary, result } with result ready to store as JSON.
 */
export function runCfo({ kind, data, settings, today, month = monthOf(today) }) {
  if (!Object.hasOwn(CFO_KINDS, kind)) throw new Error(`unknown CFO kind: ${kind}`);
  const body = BUILDERS[kind]({ data, settings, today, month });
  const label = CFO_KINDS[kind];
  const shown = body.figures.filter((f) => f.value !== null).slice(0, 3).map((f) => `${f.label} ${formatValue(f)}`);
  const summary = `${label} (${month}): ${shown.length ? shown.join(', ') : '계산할 데이터가 없습니다'}`
    + (body.findings.length ? `. 주의 항목 ${body.findings.length}건` : '.');
  return {
    summary,
    result: {
      agent: 'cfo',
      kind,
      label,
      period: month,
      generated_at: new Date().toISOString(),
      ...body,
    },
  };
}
