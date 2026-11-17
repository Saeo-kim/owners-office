import { PLAN_STATUS } from '../../core/enums.js';
import { GOAL_STATUS_LABELS } from '../../core/analytics.js';
import { demo, html, kind, kpi, num, pill, rowActions, table } from '../ui.js';
import { goalFmt, goalRow, STATUS_TONE } from './common.js';

const PLAN_TONE = { todo: '', doing: 'info', done: 'good', dropped: '' };

export async function render({ backend, query, status: appStatus }) {
  const d = await backend.get('/analysis/goals');
  const scope = query.scope ?? 'open';
  const goals = d.goals.filter((g) => (scope === 'all' ? true : scope === 'past' ? g.info.phase === 'past' : g.info.phase !== 'past'));
  const count = (s) => d.goals.filter((g) => g.status === s).length;

  const kpis = html`<div class="kpis">
    ${kpi({ label: '전체 목표', value: `${d.goals.length}개` })}
    ${kpi({ label: '달성', value: `${count('achieved')}개`, sub: `미달 ${count('missed')}개` })}
    ${kpi({ label: '순항 / 주의 / 위험', kindTag: 'expected', value: `${count('on_track')} / ${count('at_risk')} / ${count('off_track')}`, src: '진행 중 목표의 선형 추정' })}
    ${kpi({ label: '데이터 없음', value: `${count('no_data')}개`, sub: '실적 기록이 없어 판단하지 않음' })}
  </div>`;

  const cards = goals.map((g) => {
    const plans = d.plans.filter((p) => p.goal_id === g.id);
    return html`<section class="card section">
      ${goalRow(g, { actions: html`${rowActions('goals', g)}` })}
      <div class="cols-2" style="margin-top:8px">
        <div>
          <h3 style="margin-bottom:6px">실제 결과와 비교</h3>
          ${table([
            { label: '구분', cell: (r) => html`${kind(r.k)}`, primary: true },
            { label: '값', cell: (r) => r.v, num: true },
            { label: '근거', cell: (r) => html`<span class="small muted">${r.s}</span>` },
          ], [
            { k: 'target', v: goalFmt(g, g.target) + (g.lowerIsBetter ? ' 이하' : ''), s: '사용자가 정한 목표' },
            { k: 'plan', v: `${g.plans.done}/${g.plans.total} 완료 · 계획 ${num((g.plans.plannedMinutes ?? 0) / 60, 1)}시간`, s: `이 목표에 연결된 업무 실제 ${num(g.plans.actualMinutes / 60, 1)}시간` },
            { k: 'expected', v: goalFmt(g, g.expected), s: g.expectedBasis ?? (g.info.phase === 'past' ? '기간 종료' : g.info.phase === 'future' ? '시작 전' : '') },
            { k: 'actual', v: g.hasData ? goalFmt(g, g.actual) : '데이터 없음', s: g.actualSource },
          ])}
          ${g.neededPerDay ? html`<div class="small" style="margin-top:6px">남은 ${g.info.total - g.info.elapsed}일 동안 하루 <b>${goalFmt(g, g.neededPerDay)}</b>가 필요합니다.</div>` : ''}
        </div>
        <div>
          <div class="card-head" style="margin-bottom:6px"><h3>실행 계획</h3><button class="link" data-new="plans" data-preset='${JSON.stringify({ goal_id: g.id })}'>+ 계획 추가</button></div>
          ${table([
            { label: '항목', cell: (p) => html`${p.title} ${demo(p)}`, primary: true },
            { label: '마감', cell: (p) => html`<span class="${p.due_date && p.due_date < d.today && !['done', 'dropped'].includes(p.status) ? 'neg' : ''}">${p.due_date ?? '—'}</span>` },
            { label: '상태', cell: (p) => pill(PLAN_STATUS[p.status], PLAN_TONE[p.status]) },
            { label: '', cell: (p) => rowActions('plans', p) },
          ], plans, { empty: '실행 계획이 없습니다.' })}
        </div>
      </div>
    </section>`;
  });

  return {
    title: 'Strategy & Goals',
    actions: html`<select data-param="scope" aria-label="범위" style="width:auto">
      ${[['open', '진행·예정'], ['past', '지난 기간'], ['all', '전체']].map(([k, l]) => html`<option value="${k}" ${scope === k ? html`selected` : ''}>${l}</option>`)}
    </select><button class="primary" data-new="goals">+ 목표</button>`,
    body: html`${kpis}
      <div class="source" style="margin-bottom:12px">목표·계획·예상·실제는 각각 따로 저장·계산되며 서로 더하지 않습니다. 예상은 현재까지 실제 ÷ 경과 비율의 단순 선형 추정이며, 실적이 없으면 추정하지 않습니다. 상태 기준: ${Object.entries(GOAL_STATUS_LABELS).map(([k, l]) => `${l}`).join(' · ')}</div>
      ${cards.length ? cards : html`<div class="empty">해당 범위의 목표가 없습니다.</div>`}`,
  };
}
