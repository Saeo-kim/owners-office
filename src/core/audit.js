// Audit & Review rules. Every finding carries the numbers it is based on
// (evidence), where they came from (sources), and whether the judgement
// rests on actual records or on an estimate (basis).
import { CONFIDENCE, DEPARTMENTS, VENTURE_STAGES, WORK_CATEGORIES } from './enums.js';
import { addDays, daysBetween, inRange, monthOf } from './dates.js';
import {
  assets,
  employeesAnalysis,
  goalsAnalysis,
  GOAL_STATUS_LABELS,
  isRevenue,
  monthTotals,
  recentCompleteMonths,
  runway,
  sum,
  ventureAnalysis,
} from './analytics.js';

const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 };

export const RULES = {
  goal_gap: '목표와 실적의 차이',
  weak_forecast: '근거가 부족한 매출 예측',
  overload: '과도한 프로젝트 동시 진행',
  idle_cost: '불필요한 유지비',
  duplicate: '업무 중복',
  time_waste: '시간 낭비',
  finance_risk: '재무 위험',
  value_gap: '만족도와 경제적 효용의 차이',
  data_gap: '데이터 부족',
};

function finding(rule, severity, title, { detail = '', evidence = [], sources = [], recommendation = '', basis = 'actual', ref = null }) {
  return { rule, ruleLabel: RULES[rule], severity, title, detail, evidence, sources, recommendation, basis, ref };
}

export function runAudit(data, settings, today) {
  const out = [];
  const ventures = ventureAnalysis(data, today, settings);
  const activeVentures = ventures.filter((v) => v.status === 'active');
  const emp = employeesAnalysis(data);

  // 1. Goal gaps
  for (const g of goalsAnalysis(data, today)) {
    if (!['missed', 'off_track', 'at_risk'].includes(g.status)) continue;
    const unit = g.metric === 'work_hours' ? '시간' : g.metric === 'outputs' ? '건' : g.metric === 'custom' ? g.unit : '원';
    const fmt = (n) => (unit === '원' ? won(n) : `${n.toLocaleString('ko-KR')}${unit}`);
    const evidence = [
      { label: '목표', value: fmt(g.target), kind: 'target' },
      { label: '실제', value: fmt(g.actual), kind: 'actual' },
    ];
    if (g.expected !== null) evidence.push({ label: '예상 (기간 말)', value: fmt(g.expected), kind: 'expected' });
    if (g.plans.total) evidence.push({ label: '실행 계획 완료', value: `${g.plans.done}/${g.plans.total} (지연 ${g.plans.overdue})`, kind: 'plan' });
    out.push(
      finding('goal_gap', g.status === 'missed' ? (g.info.phase === 'past' ? 'medium' : 'high') : g.status === 'off_track' ? 'high' : 'medium',
        `목표 '${g.title}' ${GOAL_STATUS_LABELS[g.status]}`, {
          detail: g.status === 'missed' && g.info.phase === 'past'
            ? `${g.period} 기간이 끝났고 목표에 ${fmt(Math.abs(g.gap))} ${g.lowerIsBetter ? '초과' : '미달'}했습니다.`
            : `현재 속도라면 기간 말 ${g.expected !== null ? fmt(g.expected) : '-'}로 목표에 못 미칠 것으로 추정됩니다.`,
          evidence,
          sources: [g.actualSource, g.expectedBasis].filter(Boolean),
          recommendation: g.info.phase === 'past'
            ? '미달 원인을 실행 계획 단위로 기록하고, 다음 기간 목표는 최근 3개월 실제 평균을 기준으로 다시 정하세요.'
            : g.neededPerDay ? `남은 기간 하루 ${fmt(g.neededPerDay)}가 필요합니다. 달성이 비현실적이면 목표를 조정하고 근거를 남기세요.` : '실행 계획의 우선순위를 다시 정하세요.',
          basis: g.info.phase === 'past' ? 'actual' : 'estimate',
          ref: { resource: 'goals', id: g.id },
        }),
    );
  }

  // 2. Weak revenue forecasts
  for (const v of activeVentures) {
    const exp = v.expected.monthlyRevenue;
    if (!exp) continue;
    const sources = [`사업 #${v.id} 예상 월 매출(사용자 입력)`, `수입·지출: 사업 #${v.id}의 사업 매출 ${v.actual.recentMonths[0]}~${v.actual.recentMonths.at(-1)}`];
    const ev = [
      { label: '예상 월 매출', value: won(exp), kind: 'expected' },
      { label: '최근 3개월 실제 평균', value: won(v.actual.avgRecentRevenue), kind: 'actual' },
      { label: '신뢰도', value: CONFIDENCE[v.expected.confidence] ?? '미지정' },
    ];
    if (!v.forecast_basis.trim()) {
      out.push(finding('weak_forecast', 'high', `'${v.name}' 예상 매출에 근거가 없음`, {
        detail: `예상 월 매출 ${won(exp)}이 입력됐지만 산정 근거가 비어 있습니다.`,
        evidence: ev, sources,
        recommendation: '계약서, 대기 고객 수, 전환율처럼 확인 가능한 근거를 적거나 예상 매출을 지우세요. 근거 없는 예상은 의사결정에 쓰지 마세요.',
        ref: { resource: 'ventures', id: v.id },
      }));
    } else if (v.actual.avgRecentRevenue === 0 && (v.expected.confidence !== 'low')) {
      out.push(finding('weak_forecast', 'medium', `'${v.name}' 실적 없이 높은 신뢰도의 예상`, {
        detail: `최근 3개월 실제 매출이 0원인데 예상 월 매출 ${won(exp)}의 신뢰도를 '${CONFIDENCE[v.expected.confidence] ?? '미지정'}'로 두었습니다.`,
        evidence: ev, sources,
        recommendation: '첫 실제 매출이 생기기 전까지 신뢰도를 낮음으로 두고, 근거를 검증할 작은 실험을 계획하세요.',
        ref: { resource: 'ventures', id: v.id },
      }));
    } else if (v.expected.vsRecentActual !== null && v.expected.vsRecentActual >= 3) {
      out.push(finding('weak_forecast', 'medium', `'${v.name}' 예상이 실제의 ${v.expected.vsRecentActual}배`, {
        detail: '예상 월 매출이 최근 실적보다 크게 높습니다. 근거가 이 차이를 설명하는지 확인하세요.',
        evidence: ev, sources,
        recommendation: '예상과 실제의 차이를 만드는 가정(가격, 고객 수, 전환율)을 각각 적고 하나씩 검증하세요.',
        ref: { resource: 'ventures', id: v.id },
      }));
    }
  }

  // 3. Too many projects at once
  const max = settings.max_active_ventures ?? 3;
  if (activeVentures.length > max) {
    out.push(finding('overload', 'high', `진행 중인 사업 ${activeVentures.length}개 (한도 ${max}개)`, {
      detail: '동시에 진행하는 프로젝트가 설정한 한도를 넘었습니다. 시간과 자금이 분산됩니다.',
      evidence: activeVentures.map((v) => ({ label: v.name, value: `${v.actual.hours}시간 · 매출 ${won(v.actual.revenue)}` })),
      sources: ['사업·프로젝트 (상태=진행 중)', '업무 기록 누적 시간', `설정: 동시 진행 한도 ${max}`],
      recommendation: '시간당 매출과 단계를 비교해 하위 프로젝트를 보류로 돌리세요.',
    }));
  }
  for (const v of activeVentures) {
    if (!v.actual.lastWork) continue;
    const idle = daysBetween(v.actual.lastWork, today);
    if (idle >= 30) {
      out.push(finding('overload', 'low', `'${v.name}' ${idle}일째 작업 기록 없음`, {
        detail: '진행 중으로 표시되어 있지만 최근 한 달 동안 업무 기록이 없습니다.',
        evidence: [{ label: '마지막 작업일', value: v.actual.lastWork, kind: 'actual' }],
        sources: [`업무 기록: 사업 #${v.id}`],
        recommendation: '실제로 멈춘 프로젝트라면 상태를 보류로 바꿔 진행 목록을 정확하게 유지하세요.',
        ref: { resource: 'ventures', id: v.id },
      }));
    }
  }

  // 4. Upkeep that is not earning its keep
  for (const e of emp.rows) {
    const s = e.stats;
    if (!['cancel', 'review'].includes(s.recommendation)) continue;
    out.push(finding('idle_cost', s.recommendation === 'cancel' ? 'high' : 'medium', `'${e.name}' ${s.recommendation === 'cancel' ? '해지 권고' : '유지 검토'}`, {
      detail: `${DEPARTMENTS[e.department]} 소속. 월 ${won(s.effectiveCost)}${s.amortization ? ` (감가 ${won(s.amortization)} 포함)` : ''}. 연간 ${won(s.effectiveCost * 12)}.`,
      evidence: [
        { label: '월 비용', value: won(s.effectiveCost), kind: 'actual' },
        ...s.reasons.map((r) => ({ label: '근거', value: r })),
        ...(e.monthly_value !== null ? [{ label: '추정 경제적 효용', value: won(e.monthly_value), kind: 'expected' }] : []),
      ],
      sources: [`직원 #${e.id} 등록 정보 (사용 빈도·기여도·효용은 사용자 평가)`],
      recommendation: s.recommendation === 'cancel' ? '해지하거나 더 저렴한 요금제로 바꾸세요. 해지 후 한 달간 불편을 기록하면 판단을 검증할 수 있습니다.' : '한 달 동안 실제 사용 내역을 기록한 뒤 다시 평가하세요.',
      basis: e.monthly_value !== null ? 'estimate' : 'actual',
      ref: { resource: 'employees', id: e.id },
    }));
  }

  // 5. Duplicate duties
  for (const o of emp.overlaps) {
    const cheapest = [...o.members].sort((a, b) => a.stats.effectiveCost - b.stats.effectiveCost)[0];
    out.push(finding('duplicate', 'medium', `'${o.group}' 업무를 ${o.members.length}명이 중복 수행`, {
      detail: `같은 업무 그룹의 직원 유지비 합계가 월 ${won(o.cost)}입니다.`,
      evidence: o.members.map((m) => ({ label: m.name, value: `월 ${won(m.stats.effectiveCost)} · 기여도 ${m.contribution ?? '-'}/5` })),
      sources: ['직원: 중복 업무 그룹 (사용자 지정)'],
      recommendation: `기여도가 가장 높은 하나만 남기는 것을 검토하세요. 가장 저렴한 직원은 '${cheapest.name}'(월 ${won(cheapest.stats.effectiveCost)})입니다.`,
    }));
  }

  // 6. Time waste
  const since90 = addDays(today, -89);
  for (const v of ventures) {
    if (v.status === 'closed') continue;
    const recentMin = sum(data.worklogs.filter((l) => l.venture_id === v.id && inRange(l.date, since90, today)), (l) => l.minutes);
    if (recentMin >= 20 * 60 && v.actual.revenue === 0 && !['idea', 'validation', 'building'].includes(v.stage)) {
      out.push(finding('time_waste', 'medium', `'${v.name}' 90일간 ${Math.round(recentMin / 60)}시간 투입, 매출 0원`, {
        detail: `단계가 '${VENTURE_STAGES[v.stage]}'인데 누적 실제 매출이 없습니다.`,
        evidence: [
          { label: '최근 90일 투입', value: `${Math.round(recentMin / 60)}시간`, kind: 'actual' },
          { label: '누적 매출', value: won(0), kind: 'actual' },
          ...(v.estimate.timeCost !== null ? [{ label: '누적 시간 비용 (추정)', value: won(v.estimate.timeCost), kind: 'expected' }] : []),
        ],
        sources: [`업무 기록: 사업 #${v.id} (${since90}~${today})`, `수입·지출: 사업 #${v.id}`],
        recommendation: '매출로 이어지는 다음 단계를 하나 정하고, 2주 안에 결과가 없으면 투입 시간을 줄이세요.',
        ref: { resource: 'ventures', id: v.id },
      }));
    } else if (recentMin >= 30 * 60 && v.actual.revenue === 0) {
      out.push(finding('time_waste', 'low', `'${v.name}' 매출 없이 90일간 ${Math.round(recentMin / 60)}시간`, {
        detail: `초기 단계('${VENTURE_STAGES[v.stage]}')라 정상일 수 있지만, 검증 기준을 정해 두지 않으면 시간이 계속 들어갑니다.`,
        evidence: [{ label: '최근 90일 투입', value: `${Math.round(recentMin / 60)}시간`, kind: 'actual' }],
        sources: [`업무 기록: 사업 #${v.id}`],
        recommendation: '“언제까지 무엇이 확인되면 계속한다”는 검증 기준을 목표로 등록하세요.',
        ref: { resource: 'ventures', id: v.id },
      }));
    }
  }
  const since30 = addDays(today, -29);
  const logs30 = data.worklogs.filter((l) => inRange(l.date, since30, today));
  const min30 = sum(logs30, (l) => l.minutes);
  if (logs30.length >= 5) {
    const noOut = logs30.filter((l) => !l.output.trim());
    const share = noOut.length / logs30.length;
    if (share >= 0.4) {
      out.push(finding('time_waste', 'medium', `최근 30일 업무의 ${Math.round(share * 100)}%가 결과물 없음`, {
        detail: `${logs30.length}건 중 ${noOut.length}건(${Math.round(sum(noOut, (l) => l.minutes) / 60)}시간)에 결과물이 기록되지 않았습니다.`,
        evidence: [{ label: '결과물 없는 시간', value: `${Math.round(sum(noOut, (l) => l.minutes) / 60)}시간`, kind: 'actual' }],
        sources: [`업무 기록 (${since30}~${today})`],
        recommendation: '작업을 시작할 때 끝났을 때 남을 결과물을 먼저 적으세요. 결과물이 정의되지 않는 작업은 시간을 제한하세요.',
      }));
    }
    const adminMin = sum(logs30.filter((l) => l.category === 'admin'), (l) => l.minutes);
    if (min30 > 0 && adminMin / min30 >= 0.3) {
      out.push(finding('time_waste', 'low', `행정·관리 업무가 시간의 ${Math.round((adminMin / min30) * 100)}%`, {
        detail: `${WORK_CATEGORIES.admin} ${Math.round(adminMin / 60)}시간 / 전체 ${Math.round(min30 / 60)}시간.`,
        evidence: [{ label: '행정·관리', value: `${Math.round(adminMin / 60)}시간`, kind: 'actual' }],
        sources: [`업무 기록 (${since30}~${today})`],
        recommendation: '반복되는 관리 업무를 직원(도구)에게 맡기거나 묶어서 처리하세요.',
      }));
    }
  }

  // 7. Financial risk
  const months = recentCompleteMonths(data, today, 3);
  const mt = months.map((m) => monthTotals(data, m));
  const hasFinance = mt.some((r) => r.count > 0);
  if (hasFinance) {
    const avgRevenue = Math.round(sum(mt, (r) => r.revenue) / mt.length);
    const avgProfit = Math.round(sum(mt, (r) => r.businessProfit) / mt.length);
    const avgNonRevenue = Math.round(sum(mt, (r) => r.nonRevenueIncome) / mt.length);
    const fixedUpkeep = emp.totals.effectiveCost;
    const range = `${months[0]}~${months.at(-1)}`;
    if (avgProfit < 0) {
      out.push(finding('finance_risk', 'high', '사업이 최근 3개월 평균 적자', {
        detail: `사업 매출에서 사업 비용을 뺀 순이익이 월평균 ${won(avgProfit)}입니다. 지원금·생활비 지원은 포함하지 않았습니다.`,
        evidence: [
          { label: '월평균 사업 매출', value: won(avgRevenue), kind: 'actual' },
          { label: '월평균 사업 순이익', value: won(avgProfit), kind: 'actual' },
          { label: '월평균 매출 외 수입', value: won(avgNonRevenue), kind: 'actual' },
        ],
        sources: [`수입·지출 (${range})`],
        recommendation: '매출 외 수입에 기대지 않고 버틸 수 있는 기간을 확인하고, 사업 비용 중 고정비부터 줄이세요.',
      }));
    }
    if (fixedUpkeep > 0 && avgRevenue < fixedUpkeep) {
      out.push(finding('finance_risk', 'medium', '사업 매출이 제품·서비스 유지비보다 적음', {
        detail: `직원(제품·서비스) 월 유지비 ${won(fixedUpkeep)}를 최근 사업 매출 월평균 ${won(avgRevenue)}로 감당하지 못합니다.`,
        evidence: [
          { label: '직원 월 유지비 (감가 포함)', value: won(fixedUpkeep), kind: 'actual' },
          { label: '월평균 사업 매출', value: won(avgRevenue), kind: 'actual' },
        ],
        sources: ['직원 등록 유지비 (해지 완료 제외)', `수입·지출 (${range})`],
        recommendation: '해지 권고·검토 대상부터 정리하세요.',
      }));
    }
    if (avgRevenue > 0 && avgNonRevenue > avgRevenue) {
      out.push(finding('finance_risk', 'low', '매출 외 수입 의존도가 높음', {
        detail: `지원금·생활비 지원 등 매출 외 수입(월평균 ${won(avgNonRevenue)})이 사업 매출(${won(avgRevenue)})보다 큽니다.`,
        evidence: [
          { label: '월평균 매출 외 수입', value: won(avgNonRevenue), kind: 'actual' },
          { label: '월평균 사업 매출', value: won(avgRevenue), kind: 'actual' },
        ],
        sources: [`수입·지출 (${range})`],
        recommendation: '지원금이 끝나는 시점을 기록하고 그 전까지의 매출 목표를 세우세요.',
      }));
    }
    const rw = runway(data, today);
    if (rw.status === 'burning' && rw.months < 6) {
      out.push(finding('finance_risk', rw.months < 3 ? 'high' : 'medium', `가용자금 소진까지 약 ${rw.months}개월 (추정)`, {
        detail: '최근 평균 순현금흐름이 이어진다고 가정한 추정입니다.',
        evidence: [
          { label: '가용자금', value: won(assets(data).available), kind: 'actual' },
          { label: '월평균 순현금흐름', value: won(rw.avgNet), kind: 'actual' },
        ],
        sources: [rw.basis],
        recommendation: '고정비를 줄이거나 단기 매출을 확보하는 계획을 목표로 등록하세요.',
        basis: 'estimate',
      }));
    }
  }

  // 8. Satisfaction vs economic value
  for (const e of emp.rows) {
    if (!e.stats.active || !e.stats.satisfactionGap) continue;
    out.push(finding('value_gap', 'low', `'${e.name}' 만족도는 높지만 경제적 효용은 비용 미만`, {
      detail: '주관적 만족도와 경제적 효용을 따로 평가한 결과가 엇갈립니다. 만족도만으로 유지 결정을 하지 마세요.',
      evidence: [
        { label: '주관적 만족도', value: `${e.satisfaction}/5` },
        { label: '추정 효용 / 비용', value: `${won(e.monthly_value)} / ${won(e.stats.effectiveCost)}`, kind: 'expected' },
      ],
      sources: [`직원 #${e.id} 평가 (사용자 입력)`, e.value_basis ? `효용 근거: ${e.value_basis}` : '효용 근거 미기재'],
      recommendation: '개인 만족을 위한 비용이라면 개인 비용으로 분류하고 사업 비용에서 빼세요.',
      basis: 'estimate',
      ref: { resource: 'employees', id: e.id },
    }));
  }

  // 9. Missing data — reported instead of filled in with guesses
  const a = assets(data);
  if (!a.count) {
    out.push(finding('data_gap', 'info', '계좌·자산이 등록되지 않음', {
      detail: '자산과 가용자금, 자금 소진 기간을 계산할 수 없습니다. 추정치로 채우지 않았습니다.',
      sources: ['계좌·자산 0건'],
      recommendation: 'Finance > 계좌·자산에서 잔액과 기준일을 입력하세요.',
    }));
  } else if (daysBetween(a.oldestAsOf, today) > 45) {
    out.push(finding('data_gap', 'low', `잔액 기준일이 ${daysBetween(a.oldestAsOf, today)}일 지남`, {
      detail: '자산과 가용자금이 오래된 잔액을 기준으로 계산되고 있습니다.',
      evidence: [{ label: '가장 오래된 기준일', value: a.oldestAsOf }],
      sources: [a.source],
      recommendation: '잔액을 최신으로 갱신하세요.',
    }));
  }
  const unvalued = emp.rows.filter((e) => e.stats.active && e.stats.effectiveCost > 0 && e.monthly_value === null);
  if (unvalued.length) {
    out.push(finding('data_gap', 'info', `직원 ${unvalued.length}명의 경제적 효용 미평가`, {
      detail: '효용이 없으면 비용 대비 효용을 판단할 수 없습니다. 판단을 보류했습니다.',
      evidence: unvalued.slice(0, 6).map((e) => ({ label: e.name, value: `월 ${won(e.stats.effectiveCost)}` })),
      sources: ['직원: 월 경제적 효용 추정 비어 있음'],
      recommendation: '각 직원이 아껴 주는 시간이나 대체 비용으로 월 효용을 추정하고 근거를 적으세요.',
    }));
  }
  const unlinked = data.transactions.filter((t) => isRevenue(t) && !t.venture_id && monthOf(t.date) >= months[0]);
  if (unlinked.length) {
    out.push(finding('data_gap', 'info', `사업이 지정되지 않은 매출 ${unlinked.length}건`, {
      detail: '사업별 수익 비교에서 빠집니다.',
      evidence: [{ label: '합계', value: won(sum(unlinked, (t) => t.amount)), kind: 'actual' }],
      sources: ['수입·지출: 사업 매출, 관련 사업 없음'],
      recommendation: '각 매출에 관련 사업을 지정하세요.',
    }));
  }

  return out.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
}
