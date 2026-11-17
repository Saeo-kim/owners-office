// Bank statement CSV → normalized transactions. Pure functions: used in the
// browser (to preview a file) and in tests. Nothing here talks to a bank.
//
// Korean banks export "거래내역조회" files with different headers, e.g.
//   거래일시 | 적요 | 출금액 | 입금액 | 잔액 | 거래점
//   거래일자 | 거래시간 | 찾으신금액 | 맡기신금액 | 거래후잔액 | 기재내용
//   Date | Description | Amount (+/-) | Balance
// Excel (.xls/.xlsx) files: open in Excel → 다른 이름으로 저장 → CSV.

// Split CSV text into rows of cells. Handles quotes, "" escapes, CRLF, and
// tab- or semicolon-separated files.
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', '\t', ';'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((s) => s.trim())).filter((r) => r.some((s) => s !== ''));
}

// Header keywords, most specific first. Matching ignores spaces and case.
const COLUMN_HINTS = {
  date: ['거래일시', '거래일자', '거래일', '일시', '일자', '날짜', 'transactiondate', 'date'],
  time: ['거래시간', '시간', 'time'],
  out: ['출금액', '출금금액', '찾으신금액', '지급액', '출금', 'withdrawal', 'debit'],
  in: ['입금액', '입금금액', '맡기신금액', '입금', 'deposit', 'credit'],
  amount: ['거래금액', '금액', 'amount'],
  balance: ['거래후잔액', '잔액', '잔고', 'balance'],
  description: ['기재내용', '거래내용', '적요', '내용', '받는분', '보낸분', '메모', 'description', 'memo', 'payee'],
};

const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();

// Find the header row (banks put account info above it) and guess columns.
export function detectColumns(rows) {
  for (let h = 0; h < Math.min(rows.length, 30); h++) {
    const cells = rows[h].map(norm);
    const used = new Set();
    const pick = (key) => {
      for (const hint of COLUMN_HINTS[key]) {
        const i = cells.findIndex((c, idx) => !used.has(idx) && c.includes(hint));
        if (i >= 0) { used.add(i); return i; }
      }
      return -1;
    };
    // Order matters: "거래후잔액" must be claimed before "금액", "입금액" before "금액".
    const balance = pick('balance');
    const out = pick('out');
    const inn = pick('in');
    const amount = out < 0 && inn < 0 ? pick('amount') : -1;
    const date = pick('date');
    const time = pick('time');
    const description = pick('description');
    if (date >= 0 && (amount >= 0 || out >= 0 || inn >= 0)) {
      return { headerRow: h, date, time, out, in: inn, amount, balance, description, headers: rows[h] };
    }
  }
  return null;
}

// "1,234원", "(5,000)", "-5000", "" → integer or null
export function parseAmount(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).replace(/[,\s원₩]|KRW/g, '');
  if (s === '' || s === '-') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s));
  return neg ? -n : n;
}

// "2026.11.17 13:22", "2026-11-17", "2026/11/17", "20261117", "26.11.17" → "2026-11-17"
export function parseDate(raw) {
  const s = String(raw ?? '').trim();
  let m = s.match(/^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) {
    const short = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (short) m = [null, `20${short[1]}`, short[2], short[3]];
  }
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Rows → [{ date, direction, amount, description, balance }] plus skipped lines.
export function toTransactions(rows, cols) {
  const out = [];
  const skipped = [];
  for (let i = cols.headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const date = parseDate(r[cols.date]);
    let signed = null;
    if (cols.amount >= 0) signed = parseAmount(r[cols.amount]);
    else {
      const o = cols.out >= 0 ? parseAmount(r[cols.out]) : null;
      const n = cols.in >= 0 ? parseAmount(r[cols.in]) : null;
      if (n) signed = Math.abs(n);
      else if (o) signed = -Math.abs(o);
    }
    if (!date || !signed) {
      // Totals rows ("합계"), blank lines and footers land here.
      skipped.push({ line: i + 1, text: r.join(' | ').slice(0, 120) });
      continue;
    }
    const description = cols.description >= 0 ? r[cols.description] ?? '' : '';
    const time = cols.time >= 0 ? r[cols.time] ?? '' : (String(r[cols.date]).match(/\d{1,2}:\d{2}(:\d{2})?/)?.[0] ?? '');
    out.push({
      date,
      time,
      direction: signed > 0 ? 'income' : 'expense',
      amount: Math.abs(signed),
      description: description.slice(0, 200),
      balance: cols.balance >= 0 ? parseAmount(r[cols.balance]) : null,
    });
  }
  return { transactions: out, skipped };
}

// The balance after the most recent transaction, if the file has a balance
// column. Banks list newest-first or oldest-first, so use the file's order
// among rows that share the latest date.
export function closingBalance(transactions) {
  const withBal = transactions.filter((t) => t.balance !== null && t.balance !== undefined);
  if (!withBal.length) return null;
  const first = withBal[0];
  const last = withBal[withBal.length - 1];
  const newestFirst = first.date > last.date || (first.date === last.date && (first.time ?? '') > (last.time ?? ''));
  const latest = newestFirst ? first : last;
  return { balance: latest.balance, as_of: latest.date };
}

// One-call helper used by the UI.
export function parseBankStatement(text) {
  const rows = parseCsv(text);
  const cols = detectColumns(rows);
  if (!cols) return { error: '날짜 열과 금액(입금/출금) 열을 찾지 못했습니다. 은행에서 받은 "거래내역" CSV인지 확인하세요.', rows };
  const { transactions, skipped } = toTransactions(rows, cols);
  return { cols, transactions, skipped, closing: closingBalance(transactions) };
}

// Stable identity for duplicate detection when the same file (or an
// overlapping period) is imported twice.
export function importKeys(transactions) {
  const seen = new Map();
  return transactions.map((t) => {
    const base = [t.date, t.time ?? '', t.direction, t.amount, t.balance ?? '', t.description ?? ''].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}
