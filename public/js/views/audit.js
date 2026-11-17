import { SEVERITY } from '../../core/enums.js';
import { RULES } from '../../core/audit.js';
import { html, kpi } from '../ui.js';
import { findingCard } from './common.js';

export async function render({ backend, query }) {
  const d = await backend.get('/analysis/audit');
  const rule = query.rule ?? '';
  const sev = query.severity ?? '';
  const rows = d.findings.filter((f) => (!rule || f.rule === rule) && (!sev || f.severity === sev));
  const by = (s) => d.findings.filter((f) => f.severity === s).length;

  return {
    title: 'Audit & Review',
    actions: html`
      <select data-param="severity" aria-label="심각도" style="width:auto"><option value="">모든 심각도</option>${Object.entries(SEVERITY).map(([k, l]) => html`<option value="${k}" ${sev === k ? html`selected` : ''}>${l}</option>`)}</select>
      <select data-param="rule" aria-label="규칙" style="width:auto"><option value="">모든 규칙</option>${Object.entries(RULES).map(([k, l]) => html`<option value="${k}" ${rule === k ? html`selected` : ''}>${l}</option>`)}</select>`,
    body: html`<div class="kpis">
        ${kpi({ label: '높음', value: `${by('high')}건` })}
        ${kpi({ label: '보통', value: `${by('medium')}건` })}
        ${kpi({ label: '낮음', value: `${by('low')}건` })}
        ${kpi({ label: '참고 (데이터 부족 등)', value: `${by('info')}건` })}
      </div>
      <div class="source" style="margin-bottom:12px">${d.today} 기준 자동 감사. 각 항목은 판단에 쓴 수치(근거)와 데이터 출처를 함께 보여줍니다. '실제' 표시는 기록된 실적만으로, '예상' 표시는 추정이나 사용자 평가를 포함해 판단한 항목입니다. 데이터가 없으면 추정하지 않고 '데이터 부족'으로 보고합니다.</div>
      <div class="list">${rows.length ? rows.map((f) => findingCard(f)) : html`<div class="empty">조건에 맞는 감사 결과가 없습니다.</div>`}</div>`,
  };
}
