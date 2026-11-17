import { createBackend } from './backend.js';
import { confirmDialog, esc, html, initTooltips, openForm, toast } from './ui.js';
import { RESOURCES } from '../core/resources.js';
import * as dashboard from './views/dashboard.js';
import * as finance from './views/finance.js';
import * as employees from './views/employees.js';
import * as ventures from './views/ventures.js';
import * as goals from './views/goals.js';
import * as productivity from './views/productivity.js';
import * as audit from './views/audit.js';
import * as settings from './views/settings.js';

const ROUTES = [
  { path: 'dashboard', label: 'Executive Dashboard', ko: '경영 대시보드', view: dashboard, icon: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z"/>' },
  { path: 'finance', label: 'Finance', ko: '재무', view: finance, icon: '<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>' },
  { path: 'employees', label: 'Employees', ko: '직원 (제품·서비스)', view: employees, icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>' },
  { path: 'ventures', label: 'Ventures', ko: '사업·프로젝트', view: ventures, icon: '<path d="M5 19c4-1 6-3 7-7l5-5a2.8 2.8 0 0 0-4-4l-5 5c-4 1-6 3-7 7"/><path d="M9 15l-3 3"/>' },
  { path: 'goals', label: 'Strategy & Goals', ko: '전략·목표', view: goals, icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>' },
  { path: 'productivity', label: 'Productivity', ko: '생산성', view: productivity, icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>' },
  { path: 'audit', label: 'Audit & Review', ko: '감사·검증', view: audit, icon: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>' },
  { sep: true },
  { path: 'settings', label: 'Settings & Data', ko: '설정·데이터', view: settings, icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>' },
];

const $ = (s) => document.querySelector(s);
const main = $('#main');

function parseHash() {
  const [pathPart, queryPart = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [path = 'dashboard', ...rest] = pathPart.split('/').filter(Boolean);
  return { path, rest, query: Object.fromEntries(new URLSearchParams(queryPart)) };
}

export function setQuery(patch) {
  const { path, rest, query } = parseHash();
  const q = new URLSearchParams({ ...query, ...patch });
  for (const [k, v] of [...q]) if (v === '' || v === null) q.delete(k);
  const qs = q.toString();
  location.hash = `#/${[path, ...rest].join('/')}${qs ? `?${qs}` : ''}`;
}

function renderNav(active) {
  $('#nav').innerHTML = ROUTES.map((r) =>
    r.sep ? '<div class="nav-sep"></div>' : `<a href="#/${r.path}" ${r.path === active ? 'aria-current="page"' : ''} title="${esc(r.ko)}"><svg viewBox="0 0 24 24" aria-hidden="true">${r.icon}</svg><span>${esc(r.label)}</span></a>`,
  ).join('');
}

let backend;
let status;
let renderSeq = 0;

async function refreshStatus() {
  status = await backend.get('/status');
  const demoRows = Object.values(status.counts).reduce((n, c) => n + c.demo, 0);
  const banner = $('#demo-banner');
  if (demoRows > 0) {
    banner.hidden = false;
    banner.innerHTML = String(html`<span><strong>DEMO</strong> 데모 데이터 ${demoRows}건이 ${status.settings.include_demo ? '분석에 포함되어 있습니다' : '저장되어 있지만 분석에서 제외되어 있습니다'}. 실제 데이터와 섞여 계산되지 않도록 사용 전에 삭제하세요.</span>
      <button class="link" data-action="toggle-demo">${status.settings.include_demo ? '데모 제외하고 보기' : '데모 포함해서 보기'}</button>
      <button class="link danger" data-action="delete-demo">데모 전체 삭제</button>`);
  } else banner.hidden = true;
  $('#mode-note').innerHTML = backend.mode === 'server'
    ? '로컬 모드 · 데이터는 이 PC의 <code>data/office.db</code>에 저장됩니다.'
    : '웹 모드 · 데이터는 이 브라우저(IndexedDB)에만 저장되며 서버로 전송되지 않습니다. 설정에서 백업하세요.';
}

async function render() {
  const seq = ++renderSeq;
  const { path, rest, query } = parseHash();
  const route = ROUTES.find((r) => r.path === path) ?? ROUTES[0];
  renderNav(route.path);
  document.title = `${route.label} · OWNER'S OFFICE`;
  $('#page-title').textContent = route.label;
  closeMenu();
  const ctx = { backend, query, rest, status, setQuery };
  try {
    const out = await route.view.render(ctx);
    if (seq !== renderSeq) return;
    if (out.title) $('#page-title').textContent = out.title;
    $('#topbar-actions').innerHTML = String(out.actions ?? '');
    main.innerHTML = String(out.body);
    route.view.mount?.(main, ctx);
  } catch (err) {
    console.error(err);
    main.innerHTML = String(html`<div class="empty">화면을 불러오지 못했습니다: ${err.message}</div>`);
  }
}

async function reload() {
  await refreshStatus();
  await render();
}

function closeMenu() {
  $('#sidebar').classList.remove('open');
  $('#scrim').hidden = true;
  $('#menu-btn').setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-new],[data-edit],[data-delete],[data-action]');
  if (!el) return;
  try {
    if (el.dataset.new) {
      const preset = el.dataset.preset ? JSON.parse(el.dataset.preset) : {};
      if (await openForm({ backend, resource: el.dataset.new, preset })) {
        toast('실제 데이터로 저장했습니다.');
        await reload();
      }
    } else if (el.dataset.edit) {
      const [resource, id] = el.dataset.edit.split(':');
      const record = await backend.get(`/${resource}/${id}`);
      if (await openForm({ backend, resource, record })) {
        toast('수정했습니다.');
        await reload();
      }
    } else if (el.dataset.delete) {
      const [resource, id] = el.dataset.delete.split(':');
      const record = await backend.get(`/${resource}/${id}`);
      const name = record.name ?? record.title ?? record.task ?? record.description ?? `#${id}`;
      const extra = resource === 'goals' ? ' 연결된 실행 계획도 함께 삭제됩니다.' : '';
      if (await confirmDialog(html`${RESOURCES[resource].label} '<b>${name}</b>'을(를) 삭제할까요?${extra}`, { okLabel: '삭제', danger: true })) {
        await backend.del(`/${resource}/${id}`);
        toast('삭제했습니다.');
        await reload();
      }
    } else if (el.dataset.action === 'toggle-demo') {
      await backend.put('/settings', { include_demo: !status.settings.include_demo });
      await reload();
    } else if (el.dataset.action === 'delete-demo') {
      if (await confirmDialog('DEMO 표시된 모든 데이터를 삭제합니다. 직접 입력한 실제 데이터는 그대로 남습니다. 데모 데이터는 다시 자동으로 생성되지 않습니다.', { okLabel: '데모 삭제', danger: true })) {
        const r = await backend.del('/demo');
        toast(`데모 데이터 ${r.removed}건을 삭제했습니다.`);
        await reload();
      }
    } else if (el.dataset.action === 'seed-demo') {
      const r = await backend.post('/demo');
      toast(`데모 데이터 ${r.created}건을 추가했습니다.`);
      await reload();
    }
  } catch (err) {
    toast(err.message, true);
  }
});

// Filters: any control with data-param writes its value into the URL query.
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-param]');
  if (el && !el.closest('dialog')) setQuery({ [el.dataset.param]: el.value });
});

$('#menu-btn').addEventListener('click', () => {
  const open = !$('#sidebar').classList.contains('open');
  $('#sidebar').classList.toggle('open', open);
  $('#scrim').hidden = !open;
  $('#menu-btn').setAttribute('aria-expanded', String(open));
});
$('#scrim').addEventListener('click', closeMenu);
window.addEventListener('hashchange', render);
window.addEventListener('oo:reload', reload);

(async () => {
  initTooltips();
  try {
    backend = await createBackend();
    await reload();
  } catch (err) {
    console.error(err);
    main.innerHTML = String(html`<div class="empty">데이터 저장소를 열지 못했습니다: ${err.message}</div>`);
  }
})();

// Offline-capable PWA: service workers need HTTPS (or localhost).
// Registration failures are non-fatal; the app still works online.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('service worker not registered:', err));
  });
}
