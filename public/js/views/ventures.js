import { CONFIDENCE, VENTURE_STAGES, VENTURE_STATUS } from '../../core/enums.js';
import { columnChart, demo, html, kind, num, pill, rowActions, table, won } from '../ui.js';

const STAGE_KEYS = Object.keys(VENTURE_STAGES);
const STATUS_TONE = { active: 'good', paused: 'warn', closed: '' };

function card(v) {
  const idx = STAGE_KEYS.indexOf(v.stage);
  const a = v.actual;
  return html`<article class="card">
    <div class="card-head"><div><h2>${v.name} ${demo(v)}</h2><p>${v.summary}</p></div><div style="display:flex;gap:4px;align-items:center">${pill(VENTURE_STATUS[v.status], STATUS_TONE[v.status])}${rowActions('ventures', v)}</div></div>
    <div class="small">수익화 단계: <b>${VENTURE_STAGES[v.stage]}</b> (${idx + 1}/${STAGE_KEYS.length})</div>
    <div class="stages" aria-hidden="true">${STAGE_KEYS.map((_, i) => html`<span class="${i <= idx ? 'on' : ''}"></span>`)}</div>
    <div class="split">
      <div class="stat"><div class="k">${kind('actual')} 누적 매출</div><div class="v">${won(a.revenue)}</div></div>
      <div class="stat"><div class="k">${kind('actual')} 누적 투자 비용</div><div class="v">${won(a.cost)}</div></div>
      <div class="stat"><div class="k">${kind('actual')} 누적 손익</div><div class="v ${a.profit < 0 ? 'neg' : ''}">${won(a.profit)}</div></div>
      <div class="stat"><div class="k">${kind('actual')} 투입 시간</div><div class="v">${num(a.hours, 1)}시간</div></div>
      <div class="stat"><div class="k">${kind('actual')} 최근 3개월 월평균 매출</div><div class="v">${won(a.avgRecentRevenue)}</div></div>
      <div class="stat" style="border:1px dashed var(--expected)"><div class="k">${kind('expected')} 예상 월 매출</div><div class="v">${v.expected.monthlyRevenue ? won(v.expected.monthlyRevenue) : '없음'}</div>
        ${v.expected.monthlyRevenue ? html`<div class="small muted">신뢰도 ${CONFIDENCE[v.expected.confidence] ?? '미지정'}${v.expected.vsRecentActual ? ` · 실제의 ${v.expected.vsRecentActual}배` : ''}</div>` : ''}</div>
    </div>
    ${v.expected.monthlyRevenue ? html`<div class="source">${v.forecast_basis ? `예상 근거: ${v.forecast_basis}` : '예상 근거 없음 — 감사 대상'}</div>` : ''}
    <div style="margin-top:10px">${columnChart(a.monthly, [
      { key: 'revenue', label: '매출', color: 'var(--series-1)' },
      { key: 'cost', label: '비용', color: 'var(--series-2)' },
    ], { height: 150 })}</div>
    <div class="source">사업 #${v.id}에 연결된 거래 ${a.txCount}건, 업무 기록 ${a.logCount}건${a.lastWork ? ` · 마지막 작업 ${a.lastWork}` : ''}</div>
  </article>`;
}

export async function render({ backend, query }) {
  const d = await backend.get('/analysis/ventures');
  const status = query.status ?? 'active';
  const rows = d.ventures.filter((v) => status === 'all' || v.status === status);
  const active = d.ventures.filter((v) => v.status === 'active').length;

  const compare = html`<section class="card section">
    <div class="card-head"><div><h2>프로젝트별 성과 비교</h2><p>진행 중 ${active}개 / 동시 진행 한도 ${d.maxActive}개 ${active > d.maxActive ? html`<span class="neg">— 한도 초과</span>` : ''}</p></div></div>
    ${table([
      { label: '사업', cell: (v) => html`${v.name} ${demo(v)}<div class="muted small">${VENTURE_STAGES[v.stage]} · ${VENTURE_STATUS[v.status]}</div>`, primary: true },
      { label: '누적 매출', cell: (v) => won(v.actual.revenue), num: true },
      { label: '투자 비용', cell: (v) => won(v.actual.cost), num: true },
      { label: '손익', cell: (v) => html`<span class="${v.actual.profit < 0 ? 'neg' : ''}">${won(v.actual.profit)}</span>`, num: true },
      { label: '투입 시간', cell: (v) => `${num(v.actual.hours, 1)}h`, num: true },
      { label: '시간당 매출', cell: (v) => (v.actual.revenuePerHour === null ? '—' : won(v.actual.revenuePerHour)), num: true },
      { label: '결과물', cell: (v) => `${v.actual.outputs}건`, num: true },
      { label: '시간 비용 반영 손익', cell: (v) => (v.estimate.profitAfterTime === null ? '—' : html`${kind('expected')} <span class="${v.estimate.profitAfterTime < 0 ? 'neg' : ''}">${won(v.estimate.profitAfterTime)}</span>`), num: true },
    ], d.ventures, { empty: '등록된 사업이 없습니다.' })}
    <div class="source">실제 값은 사업에 연결한 거래와 업무 기록의 합계입니다. 시간 비용 반영 손익은 투입 시간 × 설정의 시간 가치(${won(d.hourlyValue)}/시간)를 뺀 추정치입니다.</div>
  </section>`;

  return {
    title: 'Ventures',
    actions: html`<select data-param="status" aria-label="상태" style="width:auto">
        ${[['active', '진행 중'], ['paused', '보류'], ['closed', '종료'], ['all', '전체']].map(([k, l]) => html`<option value="${k}" ${status === k ? html`selected` : ''}>${l}</option>`)}
      </select><button class="primary" data-new="ventures">+ 프로젝트</button>`,
    body: html`${compare}<div class="cols-2">${rows.length ? rows.map(card) : html`<div class="empty">해당 상태의 사업이 없습니다.</div>`}</div>`,
  };
}
