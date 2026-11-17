import { DEPARTMENTS, EMPLOYEE_KINDS, EMPLOYEE_STATUS, USAGE } from '../../core/enums.js';
import { RECOMMENDATION_LABELS } from '../../core/analytics.js';
import { demo, hbars, html, kind, kpi, pill, rowActions, table, won } from '../ui.js';

const REC_TONE = { keep: 'good', evaluate: 'info', review: 'warn', cancel: 'bad', terminated: '' };
const stars = (n) => (n === null ? html`<span class="muted">미평가</span>` : html`<span title="${n}/5">${'●'.repeat(n)}<span class="muted">${'○'.repeat(5 - n)}</span></span>`);

export async function render({ backend, query }) {
  const a = await backend.get('/analysis/employees');
  const dept = query.dept ?? '';
  const rows = a.rows.filter((r) => !dept || r.department === dept);
  const t = a.totals;

  const kpis = html`<div class="kpis">
    ${kpi({ label: '재직 직원', kindTag: 'actual', value: `${t.activeCount}명`, src: '해지 완료 제외' })}
    ${kpi({ label: '월 급여 합계 (유지비)', kindTag: 'actual', value: won(t.monthlyCost), sub: `기기 감가 ${won(t.amortization)} 별도`, src: '등록된 월 유지비 (계약 기준)' })}
    ${kpi({ label: '월 총비용 (감가 포함)', kindTag: 'actual', value: won(t.effectiveCost), sub: `연간 ${won(t.effectiveCost * 12)}` })}
    ${kpi({ label: '검토·해지 권고 비용', kindTag: 'actual', value: `${won(t.flaggedCost)}/월`, sub: '사용 빈도·기여도·효용 기준', src: '아래 규칙으로 자동 판정' })}
    ${kpi({ label: '경제적 효용 평가율', value: `${t.valuedCount}/${t.activeCount}`, sub: '미평가 직원은 판단 보류' })}
  </div>`;

  const org = html`<section class="card section">
    <div class="card-head"><div><h2>조직도</h2><p>부서별 직원 수와 월 비용 (감가 포함)</p></div></div>
    ${hbars(Object.entries(DEPARTMENTS).map(([k, l]) => ({ k, l, d: a.byDepartment[k] ?? { count: 0, cost: 0 } })).map(({ l, d }) => ({ label: l, value: d.cost, display: `${d.count}명 · ${won(d.cost)}`, tip: `${l}|${d.count}명|월 ${won(d.cost)}` })))}
  </section>`;

  const overlaps = a.overlaps.length ? html`<section class="card section">
    <div class="card-head"><div><h2>중복 업무</h2><p>같은 '중복 업무 그룹'에 속한 재직 직원</p></div></div>
    ${a.overlaps.map((o) => html`<div class="goal-row"><div class="goal-top"><strong>${o.group}</strong><span>${o.members.length}명 · 월 ${won(o.cost)}</span></div>
      <div class="small">${o.members.map((m) => `${m.name} (${won(m.stats.effectiveCost)}, 기여도 ${m.contribution ?? '-'})`).join(' / ')}</div></div>`)}
  </section>` : '';

  const list = html`<section class="card">
    <div class="card-head"><div><h2>직원 명부</h2><p>주관적 만족도와 경제적 효용은 따로 평가합니다. 판정은 사용 빈도 '거의 안 함/안 함', 기여도 ≤2, 효용 &lt; 비용 중 해당 개수로 정합니다 (2개 이상 해지 권고, 1개 검토).</p></div>
      <select data-param="dept" aria-label="부서 필터" style="width:auto"><option value="">모든 부서</option>${Object.entries(DEPARTMENTS).map(([k, l]) => html`<option value="${k}" ${dept === k ? html`selected` : ''}>${l}</option>`)}</select>
    </div>
    ${table([
      { label: '직원', cell: (r) => html`<strong>${r.name}</strong> ${demo(r)}<div class="muted small">${EMPLOYEE_KINDS[r.kind]} · ${r.role || '직무 미기재'}</div>${r.duties ? html`<div class="small">${r.duties}</div>` : ''}`, primary: true },
      { label: '부서', cell: (r) => html`<span class="small nowrap" title="${DEPARTMENTS[r.department]}">${DEPARTMENTS[r.department].split(' / ')[1]}</span>` },
      { label: '월 비용', cell: (r) => html`${won(r.stats.effectiveCost)}${r.stats.amortization ? html`<div class="muted small">감가 ${won(r.stats.amortization)} 포함</div>` : ''}`, num: true },
      { label: '사용 빈도', cell: (r) => USAGE[r.usage_frequency] },
      { label: '기여도', cell: (r) => stars(r.contribution) },
      { label: '만족도 (주관)', cell: (r) => stars(r.satisfaction) },
      { label: '경제적 효용', cell: (r) => (r.monthly_value === null ? html`<span class="muted">미평가</span>` : html`${kind('expected')} ${won(r.monthly_value)}<div class="muted small">비용 대비 ${r.stats.valueRatio === null ? '—' : `${r.stats.valueRatio}배`}</div>`), num: true },
      { label: '상태', cell: (r) => html`<div>${EMPLOYEE_STATUS[r.status]}</div>${r.overlap_group ? html`<div class="muted small">중복 그룹: ${r.overlap_group}</div>` : ''}` },
      { label: '판정', cell: (r) => html`${pill(RECOMMENDATION_LABELS[r.stats.recommendation], REC_TONE[r.stats.recommendation])}${r.stats.reasons.length ? html`<div class="muted small">${r.stats.reasons.join(', ')}</div>` : ''}${r.stats.missing.length && r.stats.active ? html`<div class="muted small">미평가: ${r.stats.missing.join(', ')}</div>` : ''}` },
      { label: '', cell: (r) => rowActions('employees', r) },
    ], rows, { empty: '등록된 직원이 없습니다. 사용 중인 기기, 구독, 서비스를 직원으로 등록하세요.' })}
    <div class="source">비용은 등록된 월 유지비 + 구입가 ÷ 내용연수. 경제적 효용은 사용자 추정치이므로 '예상'으로 표시합니다. 실제 지급액은 Finance에서 직원과 연결한 지출로 확인하세요.</div>
  </section>`;

  return {
    title: 'Employees',
    actions: html`<button class="primary" data-new="employees">+ 직원 채용</button>`,
    body: html`${kpis}<div class="cols-2">${org}${overlaps || html`<section class="card section"><div class="card-head"><h2>중복 업무</h2></div><div class="empty">중복 업무 그룹이 없습니다.</div></section>`}</div>${list}`,
  };
}
