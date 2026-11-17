import { ACCOUNT_KINDS, COST_CLASSES, COST_NATURES, DIRECTIONS, EXPENSE_SCOPES, INCOME_TYPES } from '../../core/enums.js';
import { columnChart, demo, hbars, html, kind, kpi, label, rowActions, table, won, wonShort } from '../ui.js';
import { goalRow, monthInput } from './common.js';

const TABS = [
  ['transactions', '수입·지출'],
  ['cashflow', '월별 현금흐름'],
  ['ventures', '사업별 손익'],
  ['accounts', '계좌·자산'],
  ['targets', '목표 대비 실적'],
];

const tabs = (active, month) => html`<div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<a href="#/finance/${k}?month=${month}" ${k === active ? html`aria-current="page"` : ''}>${l}</a>`)}</div>`;

function txType(t) {
  if (t.direction === 'income') return html`<span class="pill ${t.income_type === 'business_revenue' ? 'good' : 'info'}">${INCOME_TYPES[t.income_type]}</span>`;
  return html`<span class="small">${EXPENSE_SCOPES[t.scope]} · ${COST_NATURES[t.cost_nature]} · ${COST_CLASSES[t.cost_class]}</span>`;
}

export async function render({ backend, query, rest }) {
  const tab = TABS.some(([k]) => k === rest[0]) ? rest[0] : 'transactions';
  const f = await backend.get(`/analysis/finance${query.month ? `?month=${query.month}` : ''}`);
  const c = f.current;
  let body;

  const summary = html`<div class="kpis">
    ${kpi({ label: '사업 매출', kindTag: 'actual', value: won(c.revenue), src: '수입 유형=사업 매출' })}
    ${kpi({ label: '매출 외 수입', kindTag: 'actual', value: won(c.nonRevenueIncome), sub: `지원금 ${wonShort(c.income.grant)} · 생활비 ${wonShort(c.income.living_support)} · 기타 ${wonShort(c.income.personal_other)}` })}
    ${kpi({ label: '사업 비용', kindTag: 'actual', value: won(c.expense.business), sub: `개인 비용 ${wonShort(c.expense.personal)}` })}
    ${kpi({ label: '사업 순이익', kindTag: 'actual', value: won(c.businessProfit), negative: c.businessProfit < 0, src: '사업 매출 − 사업 비용' })}
    ${kpi({ label: '순현금흐름', kindTag: 'actual', value: won(c.net), negative: c.net < 0, src: '모든 수입 − 모든 지출' })}
  </div>`;

  if (tab === 'transactions') {
    const all = await backend.get('/transactions');
    const ventures = Object.fromEntries((await backend.get('/ventures?demo=all')).map((v) => [v.id, v.name]));
    const dir = query.direction ?? '';
    const type = query.type ?? '';
    const rows = all.filter((t) => t.date.startsWith(f.month))
      .filter((t) => !dir || t.direction === dir)
      .filter((t) => !type || t.income_type === type || t.cost_class === type || t.cost_nature === type || t.scope === type);
    const inc = rows.filter((t) => t.direction === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = rows.filter((t) => t.direction === 'expense').reduce((s, t) => s + t.amount, 0);
    body = html`${summary}<section class="card">
      <div class="toolbar">
        <select data-param="direction" aria-label="구분"><option value="">수입+지출</option>${Object.entries(DIRECTIONS).map(([k, l]) => html`<option value="${k}" ${dir === k ? html`selected` : ''}>${l}</option>`)}</select>
        <select data-param="type" aria-label="유형">
          <option value="">모든 유형</option>
          <optgroup label="수입 유형">${Object.entries(INCOME_TYPES).map(([k, l]) => html`<option value="${k}" ${type === k ? html`selected` : ''}>${l}</option>`)}</optgroup>
          <optgroup label="고정/변동">${Object.entries(COST_NATURES).map(([k, l]) => html`<option value="${k}" ${type === k ? html`selected` : ''}>${l}</option>`)}</optgroup>
          <optgroup label="비용 범위">${Object.entries(EXPENSE_SCOPES).map(([k, l]) => html`<option value="${k}" ${type === k ? html`selected` : ''}>${l}</option>`)}</optgroup>
          <optgroup label="비용 분류">${Object.entries(COST_CLASSES).map(([k, l]) => html`<option value="${k}" ${type === k ? html`selected` : ''}>${l}</option>`)}</optgroup>
        </select>
        <span class="muted small">${rows.length}건 · 수입 ${won(inc)} · 지출 ${won(exp)}</span>
      </div>
      ${table([
        { label: '날짜', cell: (t) => html`<span class="nowrap">${t.date}</span>` },
        { label: '내용', cell: (t) => html`${t.description || '—'} ${demo(t)}`, primary: true },
        { label: '유형', cell: txType },
        { label: '사업', cell: (t) => ventures[t.venture_id] ?? html`<span class="muted">—</span>` },
        { label: '금액', cell: (t) => html`<span class="${t.direction === 'income' ? 'pos' : ''}">${t.direction === 'income' ? '+' : '−'}${won(t.amount)}</span>`, num: true },
        { label: '', cell: (t) => rowActions('transactions', t) },
      ], rows, { empty: `${f.month}에 기록된 거래가 없습니다.` })}
    </section>`;
  } else if (tab === 'cashflow') {
    const rows = f.cashflow;
    body = html`<section class="card section">
      <div class="card-head"><div><h2>월별 현금흐름</h2><p>${rows[0].month} ~ ${rows.at(-1).month} · 실제 기록</p></div></div>
      ${columnChart(rows.map((m) => ({ ...m, inc: m.income.total, exp: m.expense.total })), [
        { key: 'inc', label: '총수입', color: 'var(--series-1)' },
        { key: 'exp', label: '총지출', color: 'var(--series-2)' },
      ], { line: { key: 'net', label: '순현금흐름', color: 'var(--text-2)' } })}
    </section>
    <section class="card">${table([
      { label: '월', cell: (m) => m.month, primary: true },
      { label: '사업 매출', cell: (m) => won(m.revenue), num: true },
      { label: '지원금', cell: (m) => won(m.income.grant), num: true },
      { label: '생활비 지원', cell: (m) => won(m.income.living_support), num: true },
      { label: '기타 개인 수입', cell: (m) => won(m.income.personal_other), num: true },
      { label: '고정비', cell: (m) => won(m.expense.fixed), num: true },
      { label: '변동비', cell: (m) => won(m.expense.variable), num: true },
      { label: '사업 순이익', cell: (m) => html`<span class="${m.businessProfit < 0 ? 'neg' : ''}">${won(m.businessProfit)}</span>`, num: true },
      { label: '순현금흐름', cell: (m) => html`<span class="${m.net < 0 ? 'neg' : ''}">${won(m.net)}</span>`, num: true },
    ], rows)}<div class="source">수입·지출 기록 합계. 사업 순이익 = 사업 매출 − 사업 비용, 순현금흐름 = 전체 수입 − 전체 지출</div></section>`;
  } else if (tab === 'ventures') {
    const rows = f.ventures;
    body = html`<section class="card section">
      <div class="card-head"><div><h2>${f.month} 사업별 손익</h2><p>사업과 연결된 거래만 집계 · 예상 매출은 계산에 쓰지 않음</p></div></div>
      ${table([
        { label: '사업', cell: (v) => html`${v.name} ${demo(v)}`, primary: true },
        { label: `${f.month} 매출`, cell: (v) => won(v.month.revenue), num: true },
        { label: `${f.month} 비용`, cell: (v) => won(v.month.cost), num: true },
        { label: `${f.month} 손익`, cell: (v) => html`<span class="${v.month.profit < 0 ? 'neg' : ''}">${won(v.month.profit)}</span>`, num: true },
        { label: '누적 매출', cell: (v) => won(v.total.revenue), num: true },
        { label: '누적 비용', cell: (v) => won(v.total.cost), num: true },
        { label: '누적 손익', cell: (v) => html`<span class="${v.total.profit < 0 ? 'neg' : ''}">${won(v.total.profit)}</span>`, num: true },
        { label: '예상 월 매출', cell: (v) => (v.expectedMonthly ? html`${kind('expected')} ${won(v.expectedMonthly)}` : '—'), num: true },
      ], rows, { empty: '등록된 사업이 없습니다.' })}
      <div class="source">사업 미지정 거래 (${f.month}): 매출 ${won(f.unassigned.revenue)}, 사업 비용 ${won(f.unassigned.cost)} — 사업별 손익에서 빠짐</div>
    </section>
    <section class="card"><div class="card-head"><h2>누적 매출 비교 (실제)</h2></div>
      ${hbars(rows.filter((v) => v.total.revenue > 0).sort((a, b) => b.total.revenue - a.total.revenue).map((v) => ({ label: v.name, value: v.total.revenue, display: won(v.total.revenue), tip: `${v.name}|누적 매출 ${won(v.total.revenue)}|누적 비용 ${won(v.total.cost)}` })), { empty: '실제 매출이 있는 사업이 없습니다.' })}
    </section>`;
  } else if (tab === 'accounts') {
    const rows = await backend.get('/accounts');
    body = html`<div class="kpis">
      ${kpi({ label: '총자산', kindTag: 'actual', value: won(f.assets.total), src: f.assets.source })}
      ${kpi({ label: '사용 가능 자금', kindTag: 'actual', value: won(f.assets.available) })}
    </div><section class="card">
      <div class="card-head"><div><h2>계좌·자산</h2><p>잔액은 사용자가 입력한 기준일 시점 값입니다. 거래를 등록해도 자동으로 바뀌지 않습니다.</p></div><button class="primary" data-new="accounts">+ 계좌·자산</button></div>
      ${table([
        { label: '이름', cell: (a) => html`${a.name} ${demo(a)}`, primary: true },
        { label: '종류', cell: (a) => label(ACCOUNT_KINDS, a.kind) },
        { label: '가용', cell: (a) => (a.liquid ? '즉시 사용 가능' : '묶인 자산') },
        { label: '기준일', cell: (a) => a.as_of },
        { label: '잔액', cell: (a) => html`<span class="${a.balance < 0 ? 'neg' : ''}">${won(a.balance)}</span>`, num: true },
        { label: '', cell: (a) => rowActions('accounts', a) },
      ], rows, { empty: '등록된 계좌가 없습니다. 자산과 가용자금은 계산되지 않습니다.' })}
    </section>`;
  } else {
    body = html`<section class="card">
      <div class="card-head"><div><h2>재무 목표 대비 실적</h2><p>지표가 사업 매출·순이익·지출 상한인 목표</p></div><button data-new="goals">+ 목표</button></div>
      ${f.goals.length ? f.goals.map((g) => goalRow(g)) : html`<div class="empty">재무 목표가 없습니다.</div>`}
    </section>`;
  }

  return {
    title: 'Finance',
    actions: html`${monthInput(f.month)}<button class="primary" data-new="transactions">+ 수입·지출</button>`,
    body: html`${tabs(tab, f.month)}${body}`,
  };
}
