import { WORK_CATEGORIES } from '../../core/enums.js';
import { columnChart, demo, hbars, html, kpi, num, rowActions, table, won } from '../ui.js';

export async function render({ backend, query }) {
  const days = query.days ?? '30';
  const p = await backend.get(`/analysis/productivity?days=${days}`);
  const logs = (await backend.get('/worklogs')).filter((l) => l.date >= p.range.start && l.date <= p.range.end);
  const ventures = Object.fromEntries((await backend.get('/ventures?demo=all')).map((v) => [v.id, v.name]));
  const diff = p.hours - p.prevHours;

  const kpis = html`<div class="kpis">
    ${kpi({ label: '실제 작업 시간', kindTag: 'actual', value: `${num(p.hours, 1)}시간`, sub: `직전 ${days}일 대비 ${diff >= 0 ? '+' : ''}${num(diff, 1)}시간`, src: `${p.range.start} ~ ${p.range.end}` })}
    ${kpi({ label: '업무 기록', kindTag: 'actual', value: `${p.logs}건`, sub: `작업한 날 ${p.activeDays}일 · 하루 평균 ${num(p.avgHoursPerActiveDay, 1)}시간` })}
    ${kpi({ label: '결과물 기록률', kindTag: 'actual', value: p.outputRate === null ? '—' : `${p.outputRate}%`, sub: `결과물 ${p.outputs}건` })}
    ${kpi({ label: '시간당 사업 매출', kindTag: 'actual', value: p.revenuePerHour === null ? '—' : won(p.revenuePerHour), sub: `같은 기간 매출 ${won(p.revenue)}`, src: '매출 ÷ 시간. 인과관계가 아닌 단순 비율' })}
  </div>`;

  const daily = html`<section class="card span-2">
    <div class="card-head"><div><h2>일별 작업 시간</h2><p>업무 기록의 실제 시간</p></div></div>
    ${columnChart(p.daily.map((d) => ({ ...d, h: Math.round((d.minutes / 60) * 10) / 10 })), [{ key: 'h', label: '작업 시간', color: 'var(--series-1)' }], {
      height: 180,
      format: (v) => `${v}h`,
      xLabel: (d) => d.date.slice(5).replace('-', '/'),
      tipFormat: (v) => `${v}시간`,
      labelEvery: Math.ceil(p.daily.length / 12),
    })}
  </section>`;

  const byCat = html`<section class="card">
    <div class="card-head"><h2>업무 유형별 시간</h2></div>
    ${hbars(Object.entries(p.byCategory).sort((a, b) => b[1] - a[1]).map(([k, m]) => ({ label: WORK_CATEGORIES[k], value: m, display: `${num(m / 60, 1)}h · ${Math.round((m / p.minutes) * 100)}%` })))}
  </section>`;

  const byVenture = html`<section class="card section">
    <div class="card-head"><div><h2>프로젝트별 생산성</h2><p>${p.source}</p></div></div>
    ${table([
      { label: '사업', cell: (v) => v.name, primary: true },
      { label: '시간', cell: (v) => `${num(v.hours, 1)}h`, num: true },
      { label: '기록', cell: (v) => `${v.logs}건`, num: true },
      { label: '결과물', cell: (v) => `${v.outputs}건 (${Math.round((v.outputs / v.logs) * 100)}%)`, num: true },
      { label: '같은 기간 매출', cell: (v) => won(v.revenue), num: true },
      { label: '시간당 매출', cell: (v) => (v.revenuePerHour === null ? '—' : won(v.revenuePerHour)), num: true },
    ], p.ventures, { empty: '이 기간 업무 기록이 없습니다.' })}
  </section>`;

  const list = html`<section class="card">
    <div class="card-head"><div><h2>업무 기록</h2><p>${p.range.start} ~ ${p.range.end}</p></div><button class="primary" data-new="worklogs">+ 업무 기록</button></div>
    ${table([
      { label: '날짜', cell: (l) => html`<span class="nowrap">${l.date}</span>` },
      { label: '업무', cell: (l) => html`${l.task} ${demo(l)}<div class="muted small">${WORK_CATEGORIES[l.category]} · ${ventures[l.venture_id] ?? '사업 미지정'}</div>`, primary: true },
      { label: '시간', cell: (l) => `${num(l.minutes / 60, 2)}h`, num: true },
      { label: '결과물', cell: (l) => (l.output ? l.output : html`<span class="muted">없음</span>`) },
      { label: '', cell: (l) => rowActions('worklogs', l) },
    ], logs, { empty: '업무 기록이 없습니다.' })}
  </section>`;

  return {
    title: 'Productivity',
    actions: html`<select data-param="days" aria-label="기간" style="width:auto">${[['7', '최근 7일'], ['30', '최근 30일'], ['90', '최근 90일']].map(([k, l]) => html`<option value="${k}" ${days === k ? html`selected` : ''}>${l}</option>`)}</select><button class="primary" data-new="worklogs">+ 업무 기록</button>`,
    body: html`${kpis}<div class="cols-3 section">${daily}${byCat}</div>${byVenture}${list}`,
  };
}
