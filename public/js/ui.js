// Small rendering toolkit: escaped templates, formatters, value-kind tags,
// tables, SVG charts, toast, confirm and record forms.
import { VALUE_KINDS } from '../core/enums.js';
import { RESOURCES } from '../core/resources.js';

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
function part(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

// ---------- formatting
export const num = (n, digits = 0) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits }));
export const won = (n) => (n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`);
export function wonShort(n) {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e8) return `${sign}${(a / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억`;
  if (a >= 1e4) return `${sign}${(a / 1e4).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
  return `${sign}${a.toLocaleString('ko-KR')}`;
}
export const hours = (min) => `${num(min / 60, 1)}시간`;
export const signCls = (n) => (n < 0 ? 'neg' : '');
export const label = (map, key) => (key === null || key === undefined ? '—' : map[key] ?? key);

export const kind = (k) => html`<span class="vk vk-${k}" title="${VALUE_KINDS[k]} 값">${VALUE_KINDS[k]}</span>`;
export const demo = (row) => (row?.is_demo ? html`<span class="demo" title="데모 데이터 (실제 데이터 아님)">DEMO</span>` : '');
export const source = (text) => (text ? html`<div class="source">${text}</div>` : '');
export const pill = (text, tone = '') => html`<span class="pill ${tone}">${text}</span>`;

export const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const icon = (name) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`);

export function kpi({ label: l, value, kindTag, sub, src, negative = false }) {
  return html`<div class="kpi">
    <div class="kpi-label">${l} ${kindTag ? kind(kindTag) : ''}</div>
    <div class="kpi-value ${negative ? 'neg' : ''}">${value}</div>
    ${sub ? html`<div class="kpi-sub">${sub}</div>` : ''}
    ${source(src)}
  </div>`;
}

export function rowActions(resource, row) {
  return html`<div class="row-actions">
    <button class="link icon-btn" data-edit="${resource}:${row.id}" aria-label="${row.name ?? row.title ?? row.task ?? '항목'} 수정" title="수정">${icon('edit')}</button>
    <button class="link icon-btn danger" data-delete="${resource}:${row.id}" aria-label="삭제" title="삭제">${icon('trash')}</button>
  </div>`;
}

// columns: [{ label, cell(row), num?, primary?, cls? }]
export function table(columns, rows, { empty = '데이터가 없습니다.', foot = null } = {}) {
  if (!rows.length) return html`<div class="empty">${empty}</div>`;
  return html`<div class="table-wrap"><table class="stack">
    <thead><tr>${columns.map((c) => html`<th class="${c.num ? 'num' : ''}">${c.label}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${columns.map((c) => html`<td data-label="${c.label}" class="${[c.num ? 'num' : '', c.primary ? 'primary' : '', c.cls ?? ''].join(' ')}">${c.cell(r)}</td>`)}</tr>`)}</tbody>
    ${foot ? html`<tfoot><tr>${foot.map((f, i) => html`<td data-label="${columns[i]?.label ?? ''}" class="${columns[i]?.num ? 'num' : ''}">${f}</td>`)}</tr></tfoot>` : ''}
  </table></div>`;
}

// ---------- charts
// Grouped columns over months, one axis (원). `series`: [{ key, label, color }]
export function columnChart(rows, series, { height = 220, format = wonShort, tipFormat = won, xLabel = (r) => r.month.slice(2).replace('-', '.'), labelEvery = 1, line = null } = {}) {
  const W = 720;
  const H = height;
  const pad = { l: 48, r: 8, t: 10, b: 24 };
  const values = rows.flatMap((r) => [...series.map((s) => r[s.key]), line ? r[line.key] : 0]);
  let max = Math.max(0, ...values);
  let min = Math.min(0, ...values);
  if (max === min) max = 1;
  const step = niceStep((max - min) / 4);
  max = Math.ceil(max / step) * step;
  min = Math.floor(min / step) * step;
  const y = (v) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / rows.length;
  const gap = 2;
  const bw = Math.min(18, (band * 0.7 - gap * (series.length - 1)) / series.length);
  const ticks = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(v);
  const cols = rows.map((r, i) => {
    const x0 = pad.l + band * i + (band - (bw * series.length + gap * (series.length - 1))) / 2;
    const tip = [xLabel(r), ...series.map((s) => `${s.label}: ${tipFormat(r[s.key])}`), ...(line ? [`${line.label}: ${tipFormat(r[line.key])}`] : [])].join('|');
    const bars = series.map((s, j) => {
      const v = r[s.key];
      const top = y(Math.max(v, 0));
      const h = Math.abs(y(v) - y(0));
      const x = x0 + j * (bw + gap);
      return h < 0.5 ? '' : `<path d="${roundedBar(x, top, bw, h, v >= 0)}" fill="${s.color}"/>`;
    }).join('');
    return `<g class="col" data-tip="${esc(tip)}"><rect class="hit" x="${pad.l + band * i}" y="${pad.t}" width="${band}" height="${H - pad.t - pad.b}"/>${bars}${(rows.length - 1 - i) % labelEvery === 0 ? `<text x="${pad.l + band * i + band / 2}" y="${H - 6}" text-anchor="middle">${esc(xLabel(r))}</text>` : ''}</g>`;
  }).join('');
  const linePath = line
    ? `<path d="${rows.map((r, i) => `${i ? 'L' : 'M'}${(pad.l + band * i + band / 2).toFixed(1)},${y(r[line.key]).toFixed(1)}`).join('')}" stroke="${line.color}" stroke-width="2" fill="none" pointer-events="none"/>` +
      rows.map((r, i) => `<circle cx="${pad.l + band * i + band / 2}" cy="${y(r[line.key])}" r="4" fill="${line.color}" stroke="var(--surface)" stroke-width="2" pointer-events="none"/>`).join('')
    : '';
  const grid = ticks.map((v) => `<line class="${v === 0 ? 'baseline' : 'grid-line'}" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${esc(format(v))}</text>`).join('');
  const legend = [...series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`), ...(line ? [`<span><i class="line" style="background:${line.color}"></i>${esc(line.label)}</span>`] : [])].join('');
  return raw(`<div class="legend">${legend}</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.label).join(', '))} 월별 차트">${grid}${cols}${linePath}</svg>`);
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
function roundedBar(x, y, w, h, up) {
  const r = Math.min(4, w / 2, h);
  if (up) return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
}

// Horizontal magnitude bars with labels: items [{ label, value, display, tip }]
export function hbars(items, { color = 'var(--series-1)', empty = '데이터 없음' } = {}) {
  if (!items.length) return html`<div class="empty">${empty}</div>`;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return html`${items.map((i) => html`<div class="hbar" data-tip="${i.tip ?? ''}">
    <span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.label}</span>
    <div class="bar"><span style="width:${Math.max(0, (Math.abs(i.value) / max) * 100).toFixed(1)}%;background:${color}"></span></div>
    <span class="num small">${i.display}</span>
  </div>`)}`;
}

export function initTooltips() {
  const tip = document.getElementById('tip');
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    const text = el?.getAttribute('data-tip');
    if (!text) {
      tip.hidden = true;
      return;
    }
    const [title, ...lines] = text.split('|');
    tip.innerHTML = `<b>${esc(title)}</b>${lines.map((l) => `<div>${esc(l)}</div>`).join('')}`;
    tip.hidden = false;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const yy = e.clientY + 14 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 14;
    tip.style.left = `${x}px`;
    tip.style.top = `${yy}px`;
  });
}

// ---------- feedback
let toastTimer;
export function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
}

export function confirmDialog(message, { okLabel = '확인', danger = false } = {}) {
  const dlg = document.getElementById('dialog');
  dlg.innerHTML = String(html`<form method="dialog">
    <div class="dlg-head"><h2>확인</h2></div>
    <div style="padding:18px">${message}</div>
    <div class="dlg-foot"><button value="cancel">취소</button><button value="ok" class="${danger ? 'primary danger' : 'primary'}">${okLabel}</button></div>
  </form>`);
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
}

// ---------- record form
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function fieldInput(key, spec, value, lookups) {
  const id = `f-${key}`;
  const v = value ?? '';
  switch (spec.type) {
    case 'textarea':
      return html`<textarea id="${id}" name="${key}" maxlength="${spec.max}">${v}</textarea>`;
    case 'enum':
      return html`<select id="${id}" name="${key}">${spec.required ? '' : html`<option value="">— 선택 안 함 —</option>`}${Object.entries(spec.values).map(([k, l]) => html`<option value="${k}" ${k === v ? raw('selected') : ''}>${l}</option>`)}</select>`;
    case 'ref':
      return html`<select id="${id}" name="${key}">${spec.required ? '' : html`<option value="">— 없음 —</option>`}${(lookups[spec.resource] ?? []).map((r) => html`<option value="${r.id}" ${r.id === Number(v) ? raw('selected') : ''}>${r.name ?? r.title}${r.is_demo ? ' (DEMO)' : ''}</option>`)}</select>`;
    case 'bool':
      return html`<input type="checkbox" id="${id}" name="${key}" ${v ? raw('checked') : ''}>`;
    case 'date':
      return html`<input type="date" id="${id}" name="${key}" value="${v}">`;
    case 'int':
      return html`<input type="text" inputmode="numeric" id="${id}" name="${key}" value="${v === '' ? '' : spec.money ? Number(v).toLocaleString('ko-KR') : v}" autocomplete="off" ${spec.money ? raw('data-money') : ''}>`;
    default:
      return html`<input type="text" id="${id}" name="${key}" value="${v}" maxlength="${spec.max}">`;
  }
}

function readForm(form, fields) {
  const out = {};
  for (const [key, spec] of Object.entries(fields)) {
    const el = form.elements[key];
    if (!el) continue;
    if (spec.type === 'bool') out[key] = el.checked;
    else if (spec.type === 'int' || spec.type === 'ref') {
      const s = el.value.replace(/[,\s원]/g, '');
      out[key] = s === '' ? null : Number(s);
    } else out[key] = el.value === '' ? null : el.value;
  }
  return out;
}

/** Opens a create/edit form. Resolves with the saved record, or null when cancelled. */
export async function openForm({ backend, resource, record = null, preset = {} }) {
  const def = RESOURCES[resource];
  const lookups = {};
  for (const spec of Object.values(def.fields)) {
    if (spec.type === 'ref' && !lookups[spec.resource]) lookups[spec.resource] = await backend.get(`/${spec.resource}?demo=all`);
  }
  const initial = {};
  for (const [key, spec] of Object.entries(def.fields)) {
    if (record) initial[key] = record[key];
    else if (Object.hasOwn(preset, key)) initial[key] = preset[key];
    else if (spec.defaultToday) initial[key] = today();
    else if (spec.defaultPeriod) initial[key] = today().slice(0, 7);
    else initial[key] = spec.default ?? null;
  }
  const dlg = document.getElementById('dialog');
  dlg.innerHTML = String(html`<form novalidate>
    <div class="dlg-head"><h2>${def.label} ${record ? '수정' : '등록'} ${demo(record)}</h2><button type="button" class="icon-btn link" data-close aria-label="닫기">${icon('x')}</button></div>
    <div class="dlg-body">
      ${record?.is_demo ? html`<div class="field wide small muted">데모 데이터입니다. 수정해도 DEMO 표시는 유지되며 데모 일괄 삭제 시 함께 삭제됩니다.</div>` : !record ? html`<div class="field wide small muted">여기서 등록한 항목은 <b>실제 데이터</b>로 저장됩니다.</div>` : ''}
      ${Object.entries(def.fields).map(([key, spec]) => html`<div class="field ${spec.type === 'textarea' ? 'wide' : ''} ${spec.type === 'bool' ? 'check' : ''}" data-field="${key}">
        ${spec.type === 'bool' ? fieldInput(key, spec, initial[key], lookups) : ''}
        <label for="f-${key}">${spec.label}${spec.required ? ' *' : ''}</label>
        ${spec.type === 'bool' ? '' : fieldInput(key, spec, initial[key], lookups)}
        ${spec.help ? html`<div class="help">${spec.help}</div>` : ''}
        <div class="err" hidden></div>
      </div>`)}
      <div class="form-error" hidden></div>
    </div>
    <div class="dlg-foot"><button type="button" data-close>취소</button><button type="submit" class="primary">저장</button></div>
  </form>`);
  const form = dlg.querySelector('form');
  const sync = () => {
    const values = readForm(form, def.fields);
    for (const [key, spec] of Object.entries(def.fields)) {
      if (spec.showIf) form.querySelector(`[data-field="${key}"]`).hidden = !spec.showIf(values);
    }
  };
  form.addEventListener('change', sync);
  form.addEventListener('input', (e) => {
    if (e.target.matches('[data-money]')) {
      const digits = e.target.value.replace(/[^\d]/g, '');
      e.target.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
    }
  });
  sync();
  dlg.showModal();
  form.querySelector('input:not([type=checkbox]),select,textarea')?.focus();

  return new Promise((resolve) => {
    const close = (value) => {
      dlg.close();
      resolve(value);
    };
    dlg.addEventListener('cancel', () => resolve(null), { once: true });
    form.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(null)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('.err').forEach((el) => (el.hidden = true));
      form.querySelectorAll('.field').forEach((el) => el.classList.remove('invalid'));
      const body = readForm(form, def.fields);
      try {
        const saved = record ? await backend.put(`/${resource}/${record.id}`, body) : await backend.post(`/${resource}`, body);
        close(saved);
      } catch (err) {
        const errors = err.errors ?? { _: err.message };
        for (const [key, msg] of Object.entries(errors)) {
          const box = form.querySelector(`[data-field="${key}"]`);
          if (box) {
            box.classList.add('invalid');
            const el = box.querySelector('.err');
            el.textContent = msg;
            el.hidden = false;
          } else {
            const el = form.querySelector('.form-error');
            el.textContent = msg;
            el.hidden = false;
          }
        }
        form.querySelector('.invalid input, .invalid select, .invalid textarea')?.focus();
      }
    });
  });
}
