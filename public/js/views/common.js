import { GOAL_METRICS, PERIOD_TYPES, SEVERITY } from '../../core/enums.js';
import { GOAL_STATUS_LABELS } from '../../core/analytics.js';
import { demo, html, kind, num, pill, source, won } from '../ui.js';

export const STATUS_TONE = {
  achieved: 'good', on_track: 'good', in_progress: 'info', at_risk: 'warn',
  off_track: 'bad', missed: 'bad', not_started: '', no_data: '',
};
export const SEVERITY_TONE = { high: 'bad', medium: 'serious', low: 'warn', info: 'info' };

export function goalUnit(g) {
  if (g.metric === 'work_hours') return '시간';
  if (g.metric === 'outputs') return '건';
  if (g.metric === 'custom') return g.unit || '';
  return '원';
}
export const goalFmt = (g, v) => (v === null || v === undefined ? '—' : goalUnit(g) === '원' ? won(v) : `${num(v, 1)}${goalUnit(g)}`);

export function goalRow(g, { actions = '' } = {}) {
  const pct = g.progress === null ? 0 : Math.min(100, g.progress);
  const expPct = g.expected === null || !g.target ? null : Math.min(100, (g.expected / g.target) * 100);
  return html`<div class="goal-row">
    <div class="goal-top">
      <div><strong>${g.title}</strong> ${demo(g)} <span class="muted small">${PERIOD_TYPES[g.period_type]} ${g.period} · ${GOAL_METRICS[g.metric]}</span></div>
      <div style="display:flex;gap:6px;align-items:center">${pill(GOAL_STATUS_LABELS[g.status], STATUS_TONE[g.status])}${actions}</div>
    </div>
    <div class="bar" title="실제 ${g.progress ?? '-'}%${expPct !== null ? ` · 예상 ${Math.round(expPct)}%` : ''}">
      <span style="width:${pct}%;background:${g.lowerIsBetter ? 'var(--series-2)' : 'var(--series-1)'}"></span>
      ${expPct !== null ? html`<i style="left:calc(${expPct}% - 1px)"></i>` : ''}
    </div>
    <div class="vals">
      <span>${kind('target')} ${goalFmt(g, g.target)}${g.lowerIsBetter ? ' 이하' : ''}</span>
      <span>${kind('actual')} ${g.hasData ? goalFmt(g, g.actual) : '데이터 없음'} ${g.progress !== null ? html`<span class="muted">(${num(g.progress, 1)}%)</span>` : ''}</span>
      <span>${kind('expected')} ${g.expected === null ? html`<span class="muted">추정 안 함</span>` : goalFmt(g, g.expected)}</span>
      ${g.plans.total ? html`<span>${kind('plan')} ${g.plans.done}/${g.plans.total} 완료${g.plans.overdue ? html` · <span class="neg">지연 ${g.plans.overdue}</span>` : ''}</span>` : ''}
    </div>
    ${source(`${g.actualSource}${g.expectedBasis ? ` / 예상: ${g.expectedBasis}` : ''}`)}
  </div>`;
}

const REF_LINKS = { goals: '#/goals', ventures: '#/ventures', employees: '#/employees' };

export function findingCard(f, { compact = false } = {}) {
  return html`<article class="finding ${f.severity}">
    <div class="finding-head">
      ${pill(SEVERITY[f.severity], SEVERITY_TONE[f.severity])}
      <h3>${f.title}</h3>
      <span class="muted small">${f.ruleLabel}</span>
      ${f.basis === 'estimate' ? kind('expected') : kind('actual')}
    </div>
    ${compact ? '' : html`<p>${f.detail}</p>`}
    ${f.evidence.length && !compact ? html`<div class="evidence">${f.evidence.map((e) => html`<span><em>${e.label}</em> ${e.kind ? kind(e.kind) : ''} <b>${e.value}</b></span>`)}</div>` : ''}
    ${compact ? '' : html`<div class="recommend">${f.recommendation}</div>`}
    ${source(f.sources.join(' / '))}
    ${f.ref && !compact ? html`<div><a href="${REF_LINKS[f.ref.resource]}" class="small">관련 항목 보기 →</a></div>` : ''}
  </article>`;
}

export const monthInput = (month) => html`<label class="small muted" for="month-pick">기준 월</label><input id="month-pick" type="month" value="${month}" data-param="month" style="width:auto">`;
