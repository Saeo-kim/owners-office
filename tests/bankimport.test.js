import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closingBalance, importKeys, parseAmount, parseBankStatement, parseDate } from '../src/core/bankcsv.js';
import { setup } from './helpers.js';

// Layout 1: account info above the header, newest first, 출금/입금 split, a totals row.
const KB_STYLE = `"계좌번호","123-45-678901"
"조회기간","2026.11.01 ~ 2026.11.17"

"거래일시","적요","출금액","입금액","잔액","거래점"
"2026.11.15 18:02:11","스타벅스","5,800","0","1,234,200","카드"
"2026.11.10 09:00:00","사주리딩 입금 홍OO","0","9,900","1,240,000","인터넷"
"2026.11.03 12:30:45","월세","500,000","0","1,230,100","자동이체"
"합계","","505,800","9,900","",""
`;

// Layout 2: separate date and time, 찾으신/맡기신 wording, oldest first, tab-separated.
const SHINHAN_STYLE = [
  '거래일자\t거래시간\t적요\t찾으신금액\t맡기신금액\t거래후잔액\t기재내용',
  '2026-11-01\t10:00:00\t급여\t\t2,000,000\t2,000,000\t회사',
  '2026-11-02\t11:00:00\t체크\t12,000\t\t1,988,000\tGS25',
].join('\n');

// Layout 3: English, one signed amount column, no balance.
const SIGNED = `Date,Description,Amount
2026/11/05,Claude subscription,"-29,000"
2026/11/06,Client payment,"(1,000)"
2026/11/07,Refund,+3000
`;

test('parses amounts and dates in common bank formats', () => {
  assert.equal(parseAmount('1,234원'), 1234);
  assert.equal(parseAmount('(5,000)'), -5000);
  assert.equal(parseAmount('-'), null);
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseDate('2026.11.17 13:22:11'), '2026-11-17');
  assert.equal(parseDate('20261117'), '2026-11-17');
  assert.equal(parseDate('26.11.17'), '2026-11-17');
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('합계'), null);
});

test('KB-style file: finds header below preamble, skips totals, closing balance from newest row', () => {
  const r = parseBankStatement(KB_STYLE);
  assert.equal(r.cols.headerRow, 2);
  assert.equal(r.transactions.length, 3);
  assert.deepEqual(r.transactions.map((t) => [t.direction, t.amount]), [['expense', 5800], ['income', 9900], ['expense', 500000]]);
  assert.equal(r.skipped.length, 1);
  assert.deepEqual(r.closing, { balance: 1234200, as_of: '2026-11-15' });
});

test('Shinhan-style file: tab separated, oldest first', () => {
  const r = parseBankStatement(SHINHAN_STYLE);
  assert.equal(r.transactions.length, 2);
  assert.equal(r.transactions[0].description, '회사');
  assert.deepEqual(r.closing, { balance: 1988000, as_of: '2026-11-02' });
});

test('signed single-amount file without a balance column', () => {
  const r = parseBankStatement(SIGNED);
  assert.deepEqual(r.transactions.map((t) => [t.direction, t.amount]), [['expense', 29000], ['expense', 1000], ['income', 3000]]);
  assert.equal(r.closing, null);
});

test('rejects files without date and amount columns', () => {
  assert.ok(parseBankStatement('a,b\n1,2').error);
});

test('identical rows in one file get distinct keys', () => {
  const t = { date: '2026-11-01', direction: 'expense', amount: 1000, description: 'x', balance: null };
  assert.deepEqual(importKeys([t, t]), ['2026-11-01||expense|1000||x', '2026-11-01||expense|1000||x#2']);
  assert.equal(closingBalance([]), null);
});

test('import API: dry run, real import, duplicates skipped, balance marked verified', () => {
  const { call } = setup();
  const acc = call('POST', '/accounts', { name: '국민 입출금', kind: 'bank', balance: 1000000, as_of: '2026-10-31' }).body;
  assert.equal(acc.source, 'manual');

  const parsed = parseBankStatement(KB_STYLE);
  const body = { account_id: acc.id, rows: parsed.transactions, keys: importKeys(parsed.transactions), closing: parsed.closing };

  const dry = call('POST', '/bank-import', { ...body, dry_run: true });
  assert.equal(dry.status, 200);
  assert.equal(dry.body.created, 3);
  assert.equal(call('GET', '/transactions').body.length, 0, 'dry run writes nothing');

  const first = call('POST', '/bank-import', body).body;
  assert.equal(first.created, 3);
  assert.equal(first.duplicates, 0);
  assert.equal(first.account.balance, 1234200);
  assert.equal(first.account.as_of, '2026-11-15');
  assert.equal(first.account.source, 'bank_csv');

  const again = call('POST', '/bank-import', body).body;
  assert.equal(again.created, 0);
  assert.equal(again.duplicates, 3);

  const txs = call('GET', '/transactions').body;
  assert.ok(txs.every((t) => t.source === 'bank_csv' && t.needs_review === 1 && t.account_id === acc.id));
  // Unreviewed income is never business revenue.
  assert.ok(txs.filter((t) => t.direction === 'income').every((t) => t.income_type === 'personal_other'));

  // Classifying a row by editing it clears the review flag.
  const inc = txs.find((t) => t.direction === 'income');
  const edited = call('PUT', `/transactions/${inc.id}`, { income_type: 'business_revenue' }).body;
  assert.equal(edited.needs_review, 0);
  assert.equal(edited.source, 'bank_csv');

  // Typing a different balance by hand makes it unverified again.
  const manual = call('PUT', `/accounts/${acc.id}`, { balance: 1 }).body;
  assert.equal(manual.source, 'manual');
});

test('import API validates input', () => {
  const { call } = setup();
  assert.equal(call('POST', '/bank-import', {}).status, 400);
  assert.equal(call('POST', '/bank-import', { account_id: 999, rows: [], keys: [] }).status, 404);
});

test('backup round-trip keeps provenance', () => {
  const { call } = setup();
  const acc = call('POST', '/accounts', { name: 'A', kind: 'bank', balance: 0, as_of: '2026-11-01' }).body;
  const parsed = parseBankStatement(SHINHAN_STYLE);
  call('POST', '/bank-import', { account_id: acc.id, rows: parsed.transactions, keys: importKeys(parsed.transactions), closing: parsed.closing });
  const backup = call('GET', '/export').body;

  const other = setup();
  assert.equal(other.call('POST', '/import', backup).status, 200);
  assert.equal(other.call('GET', `/accounts/${acc.id}`).body.source, 'bank_csv');
  const txs = other.call('GET', '/transactions').body;
  assert.ok(txs.every((t) => t.source === 'bank_csv' && t.import_key && t.needs_review === 1));
});
