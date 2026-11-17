import { VENTURE_STAGES } from '../../core/enums.js';
import { columnChart, demo, html, kpi, num, table, won, wonShort } from '../ui.js';
import { findingCard, goalRow, monthInput } from './common.js';

function delta(cur, prev) {
  if (!prev) return '';
  const d = cur - prev;
  return `전월 대비 ${d >= 0 ? '+' : ''}${won(d)}`;
}

export async function render({ backend, query }) {
  const d = await backend.get(`/analysis/dashboard${query.month ? `?month=${query.month}` : ''}`);
  const c = d.current;
  const p = d.previous;
  const rw = d.runway;
  const range = `수입·지출 ${c.count}건 (${d.month})`;

  const runwayValue = rw.status === 'no_data' ? '데이터 없음' : rw.status === 'positive' ? '소진 없음' : `약 ${num(rw.months, 1)}개월`;

  const kpis = html`<div class="kpis">
    ${kpi({ label: '총자산', kindTag: 'actual', value: won(d.assets.total), src: d.assets.source, negative: d.assets.total < 0 })}
    ${kpi({ label: '사용 가능 자금', kindTag: 'actual', value: won(d.assets.available), src: '즉시 사용 가능으로 표시한 계좌 잔액 합계' })}
    ${kpi({ label: '사업 매출', kindTag: 'actual', value: won(c.revenue), sub: delta(c.revenue, p.revenue), src: `${range} 중 수입 유형=사업 매출만` })}
    ${kpi({ label: '사업 순이익', kindTag: 'actual', value: won(c.businessProfit), negative: c.businessProfit < 0, sub: `매출 ${wonShort(c.revenue)} − 사업 비용 ${wonShort(c.expense.business)}`, src: '지원금·생활비 지원·개인 비용 제외' })}
    ${kpi({ label: '매출 외 수입', kindTag: 'actual', value: won(c.nonRevenueIncome), sub: `지원금 ${wonShort(c.income.grant)} · 생활비 지원 ${wonShort(c.income.living_support)} · 기타 ${wonShort(c.income.personal_other)}`, src: '매출로 계산하지 않음' })}
    ${kpi({ label: '총지출', kindTag: 'actual', value: won(c.expense.total), sub: `고정 ${wonShort(c.expense.fixed)} · 변동 ${wonShort(c.expense.variable)}`, src: range })}
    ${kpi({ label: '제품·서비스 고정 유지비', kindTag: 'actual', value: `${won(d.upkeep.effectiveCost)}/월`, sub: `급여 ${wonShort(d.upkeep.monthlyCost)} + 기기 감가 ${wonShort(d.upkeep.amortization)} · ${d.upkeep.activeCount}명`, src: '직원 등록 유지비 (해지 완료 제외, 계약 기준)' })}
    ${kpi({ label: '인건비 (사람)', kindTag: 'actual', value: won(c.expense.byClass.labor ?? 0), sub: '제품·서비스 유지비와 별도 집계', src: `${range} 중 비용 분류=인건비` })}
    ${kpi({ label: '자금 소진까지', kindTag: 'expected', value: runwayValue, sub: rw.avgNet !== null ? `최근 3개월 평균 순현금흐름 ${won(rw.avgNet)}` : '', src: rw.basis })}
  </div>`;

  const chart = html`<section class="card span-2">
    <div class="card-head"><div><h2>월별 수입과 지출</h2><p>최근 12개월 · 실제 기록만 · 막대에 마우스를 올리면 금액</p></div></div>
    ${columnChart(d.cashflow.map((m) => ({ ...m, inc: m.income.total, exp: m.expense.total, rev: m.revenue })), [
      { key: 'rev', label: '사업 매출', color: 'var(--series-1)' },
      { key: 'inc', label: '총수입 (매출+기타)', color: 'var(--series-3)' },
      { key: 'exp', label: '총지출', color: 'var(--series-2)' },
    ])}
    <details class="table-view"><summary>표로 보기</summary>
      ${table([
        { label: '월', cell: (m) => m.month, primary: true },
        { label: '사업 매출', cell: (m) => won(m.revenue), num: true },
        { label: '매출 외 수입', cell: (m) => won(m.nonRevenueIncome), num: true },
        { label: '총지출', cell: (m) => won(m.expense.total), num: true },
        { label: '사업 순이익', cell: (m) => html`<span class="${m.businessProfit < 0 ? 'neg' : ''}">${won(m.businessProfit)}</span>`, num: true },
        { label: '순현금흐름', cell: (m) => html`<span class="${m.net < 0 ? 'neg' : ''}">${won(m.net)}</span>`, num: true },
      ], d.cashflow)}
    </details>
  </section>`;

  const alerts = html`<section class="card">
    <div class="card-head"><div><h2>경영 위험 알림</h2><p>감사 결과 ${d.auditCount}건 중 높음·보통</p></div><a href="#/audit" class="small">전체 보기 →</a></div>
    <div class="list">${d.alerts.length ? d.alerts.map((f) => findingCard(f, { compact: true })) : html`<div class="empty">높음·보통 위험이 없습니다.</div>`}</div>
  </section>`;

  const ventures = html`<section class="card">
    <div class="card-head"><div><h2>진행 프로젝트와 사업별 수익</h2><p>${d.month} 실제 매출 · 예상은 별도 표시</p></div><a href="#/ventures" class="small">사업 →</a></div>
    ${table([
      { label: '사업', cell: (v) => html`${v.name} ${demo(v)}<div class="muted small">${VENTURE_STAGES[v.stage]} · 누적 ${num(v.hours, 1)}시간</div>`, primary: true },
      { label: '이달 매출 (실제)', cell: (v) => won(v.monthRevenue), num: true },
      { label: '이달 비용', cell: (v) => won(v.monthCost), num: true },
      { label: '예상 월 매출', cell: (v) => (v.expectedMonthly ? html`<span style="color:var(--expected)">${won(v.expectedMonthly)}</span>` : html`<span class="muted">없음</span>`), num: true },
    ], d.ventures, { empty: '진행 중인 사업이 없습니다.' })}
  </section>`;

  const goals = html`<section class="card">
    <div class="card-head"><div><h2>목표 달성 현황</h2><p>${d.month} 월간 목표와 ${d.month.slice(0, 4)} 연간 목표</p></div><a href="#/goals" class="small">목표 →</a></div>
    ${d.goals.length ? d.goals.map((g) => goalRow(g)) : html`<div class="empty">이 기간의 목표가 없습니다. <button class="link" data-new="goals">목표 등록</button></div>`}
  </section>`;

  return {
    title: 'Executive Dashboard',
    actions: html`${monthInput(d.month)}<button class="primary" data-new="transactions">+ 수입·지출</button>`,
    body: html`${kpis}<div class="cols-3 section">${chart}${alerts}</div><div class="cols-2">${ventures}${goals}</div>`,
  };
}
