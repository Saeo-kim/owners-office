// Cash Desk: real money first. Three strictly separated zones:
//   1. 실제 (actual)   – money that moved in or out of an account, and balances
//   2. 약속 (promised) – contracts and invoices not yet paid, taxes not yet due
//   3. 예상 (estimate) – venture forecasts and hypotheses
// Nothing from zone 2 or 3 is ever added to a zone-1 number.
import { RECEIVABLE_STATUS, OBLIGATION_KINDS, OBLIGATION_STATUS, ACCOUNT_KINDS } from '../../core/enums.js';
import { html, kind, kpi, label, pill, rowActions, table, toast, won } from '../ui.js';
import { importKeys, parseBankStatement } from '../../core/bankcsv.js';

// Provenance badge: only numbers read from a bank's own statement file are "검증".
const srcPill = (s) => (s === 'bank_csv' ? pill('은행 내역 검증', 'good') : pill('직접 입력', 'warn'));
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

// A planning assumption, shown with its formula. Confirm the real rate with a 세무사.
const TAX_RESERVE_RATE = 0.2;

const sum = (rows, f) => rows.reduce((n, r) => n + (f(r) ?? 0), 0);
const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function render({ backend, status }) {
  const [accounts, txs, receivables, obligations, ventures] = await Promise.all([
    backend.get('/accounts'),
    backend.get('/transactions'),
    backend.get('/receivables'),
    backend.get('/obligations'),
    backend.get('/ventures'),
  ]);
  const today = status.today;
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const in30 = addDays(today, 30);

  const liquid = sum(accounts.filter((a) => a.liquid), (a) => a.balance);
  const monthTx = txs.filter((t) => t.date.startsWith(month));
  const yearTx = txs.filter((t) => t.date.startsWith(year));
  const income = (rows) => rows.filter((t) => t.direction === 'income');
  const expense = (rows) => rows.filter((t) => t.direction === 'expense');
  const revenue = (rows) => income(rows).filter((t) => t.income_type === 'business_revenue');

  const mIn = sum(income(monthTx), (t) => t.amount);
  const mRevenue = sum(revenue(monthTx), (t) => t.amount);
  const mOut = sum(expense(monthTx), (t) => t.amount);
  const mBizOut = sum(expense(monthTx).filter((t) => t.scope === 'business'), (t) => t.amount);
  const yRevenue = sum(revenue(yearTx), (t) => t.amount);
  const yBizOut = sum(expense(yearTx).filter((t) => t.scope === 'business'), (t) => t.amount);
  const yProfit = yRevenue - yBizOut;

  const upcoming = obligations.filter((o) => o.status === 'upcoming');
  const due30 = upcoming.filter((o) => o.due_date <= in30);
  const due30Sum = sum(due30, (o) => o.amount);
  const taxPaidThisYear = sum(obligations.filter((o) => o.status === 'paid' && ['income_tax', 'local_tax', 'vat'].includes(o.kind) && (o.paid_on ?? '').startsWith(year)), (o) => o.amount);
  const taxReserve = Math.max(0, Math.round(yProfit * TAX_RESERVE_RATE) - taxPaidThisYear);
  const spendable = liquid - due30Sum - taxReserve;

  const open = receivables.filter((r) => r.status === 'contract' || r.status === 'invoiced');
  const overdue = receivables.filter((r) => r.status === 'invoiced' && r.due_date && r.due_date < today);
  const expected = sum(ventures.filter((v) => v.status === 'active'), (v) => v.expected_monthly_revenue);
  const demo = [...accounts, ...txs, ...receivables, ...obligations].some((r) => r.is_demo);

  const liquidAccounts = accounts.filter((a) => a.liquid);
  const verified = sum(liquidAccounts.filter((a) => a.source === 'bank_csv'), (a) => a.balance);
  const unverified = liquid - verified;
  const review = txs.filter((t) => t.needs_review);
  const bankAccounts = accounts.filter((a) => !a.is_demo);

  return {
    title: 'Cash Desk',
    actions: html`<button data-new="transactions">+ 실제 입출금</button><button data-new="receivables">+ 계약·청구</button><button data-new="obligations">+ 세금·납부</button>`,
    body: html`
      <section class="cash-hero">
        <div class="cash-hero-main">
          <div class="cash-eyebrow">지금 쓸 수 있는 돈 ${kind('actual')}</div>
          <div class="cash-big ${spendable < 0 ? 'neg' : ''}">${won(spendable)}</div>
          <div class="cash-formula">가용 자금 ${won(liquid)} − 30일 내 납부 ${won(due30Sum)} − 세금 적립 ${won(taxReserve)}</div>
        </div>
        <div class="cash-hero-side">
          <div><span>이번 달 실제 입금</span><strong>${won(mIn)}</strong></div>
          <div><span>이번 달 실제 출금</span><strong>${won(mOut)}</strong></div>
          <div><span>이번 달 사업 순이익 (현금)</span><strong class="${mRevenue - mBizOut < 0 ? 'neg' : ''}">${won(mRevenue - mBizOut)}</strong></div>
        </div>
      </section>
      ${demo ? html`<div class="source" style="margin:-6px 0 14px">DEMO 데이터가 포함되어 있습니다. 내 실제 돈을 보려면 설정에서 데모를 삭제하세요.</div>` : ''}

      <h2 class="ledger-title"><span>1</span> 실제 — 통장에 들어오고 나간 돈</h2>
      <div class="kpis">
        ${kpi({ label: '은행 내역으로 검증된 잔액', value: won(verified), kindTag: 'actual', sub: `${liquidAccounts.filter((a) => a.source === 'bank_csv').length}개 계좌 · 은행이 만든 거래내역 파일 기준`, src: '아래 "은행 거래내역 가져오기"로 갱신' })}
        ${kpi({ label: '직접 입력한 잔액 (미검증)', value: won(unverified), kindTag: 'actual', sub: unverified ? '은행 앱에서 확인한 숫자가 맞는지 주기적으로 대조하세요' : '미검증 잔액 없음', src: '계좌·자산에 손으로 적은 잔액' })}
        ${kpi({ label: '분류 대기 거래', value: `${review.length}건`, sub: review.length ? '분류 전에는 사업 매출·사업 비용에 들어가지 않습니다' : '모두 분류됨', src: '은행 파일에서 가져온 거래' })}
      </div>

      <section class="card section">
        <div class="card-head"><div><h2>계좌별 잔액과 출처</h2><p>잔액 기준일이 오래되면 실제 잔액과 다를 수 있습니다. 7일 넘게 지난 잔액은 노란색.</p></div><button data-new="accounts">+ 계좌</button></div>
        ${table([
          { label: '계좌', primary: true, cell: (a) => html`<strong>${a.name}</strong><br><span class="muted small">${label(ACCOUNT_KINDS, a.kind)}${a.liquid ? '' : ' · 즉시 사용 불가'}</span>` },
          { label: '출처', cell: (a) => srcPill(a.source) },
          { label: '기준일', cell: (a) => (daysBetween(a.as_of, today) > 7 ? pill(`${a.as_of} (${daysBetween(a.as_of, today)}일 전)`, 'warn') : a.as_of) },
          { label: '잔액', num: true, cell: (a) => won(a.balance) },
          { label: '', cell: (a) => rowActions('accounts', a) },
        ], accounts, { empty: '계좌가 없습니다. "+ 계좌"로 입출금 통장을 먼저 만든 뒤 거래내역 파일을 가져오세요.' })}
      </section>

      <section class="card section" id="bank-import">
        <div class="card-head"><div><h2>은행 거래내역 가져오기 (CSV)</h2>
          <p>은행 앱·인터넷뱅킹 → 거래내역조회 → 엑셀/CSV 저장 → 여기서 선택. 파일은 이 PC 안에서만 읽고, 은행에 접속하거나 비밀번호를 묻지 않습니다. 같은 파일을 다시 넣어도 중복은 건너뜁니다.
          엑셀(.xls/.xlsx)이면 엑셀에서 "다른 이름으로 저장 → CSV"로 바꿔 주세요.</p></div></div>
        ${bankAccounts.length ? html`
          <div class="bank-import-row" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0">
            <label>계좌 <select id="bi-account">${bankAccounts.map((a) => html`<option value="${a.id}">${a.name}</option>`)}</select></label>
            <input type="file" id="bi-file" accept=".csv,.txt,.tsv,text/csv" />
          </div>
          <div id="bi-preview"></div>`
        : html`<div class="empty">먼저 "+ 계좌"로 계좌를 하나 만드세요 (잔액은 0으로 두면 파일의 잔액으로 채워집니다).</div>`}
      </section>

      ${review.length ? html`<section class="card section">
        <div class="card-head"><div><h2>분류 대기 ${pill(`${review.length}건`, 'warn')}</h2><p>수정 버튼으로 사업 매출/사업 비용/개인 비용을 지정하면 대기 목록에서 빠집니다. 지정 전에는 개인 수입·개인 지출로 계산됩니다.</p></div></div>
        ${table([
          { label: '날짜', cell: (t) => t.date },
          { label: '내용', primary: true, cell: (t) => t.description || '—' },
          { label: '구분', cell: (t) => (t.direction === 'income' ? pill('입금', 'good') : pill('출금', '')) },
          { label: '금액', num: true, cell: (t) => won(t.amount) },
          { label: '', cell: (t) => rowActions('transactions', t) },
        ], review.slice(0, 50))}
        ${review.length > 50 ? html`<p class="muted small">최근 50건만 표시. 나머지는 Finance에서.</p>` : ''}
      </section>` : ''}

      <details class="card section">
        <summary><strong>왜 은행에 바로 연결하지 않나요?</strong> (자동 연동 조사 결과)</summary>
        <ul>
          <li><b>금융결제원 오픈뱅킹</b>: 이용기관 심사를 통과한 사업자만 실제 계좌 API를 쓸 수 있습니다. 개인 개발자는 테스트베드(가짜 데이터)만 가능합니다.</li>
          <li><b>마이데이터</b>: 금융위원회 허가를 받은 사업자 전용입니다. 개인 앱이 직접 받을 수 없습니다.</li>
          <li><b>CODEF 등 스크래핑 API</b>: 사업자 계약이 필요하고, 공동/금융인증서를 앱에 맡기는 방식이라 보안 부담이 큽니다. 비밀번호·인증서를 이 앱에 저장하지 않는다는 원칙과 맞지 않아 쓰지 않습니다.</li>
          <li><b>현실적인 방법</b>: 뱅크샐러드·토스 같은 허가받은 앱으로 잔액을 확인하고, 이 앱에는 은행 거래내역 파일을 월 1–2회 가져옵니다. 이 앱은 송금·결제 기능이 없으며 앞으로도 넣지 않습니다.</li>
        </ul>
      </details>

      <div class="kpis">
        ${kpi({ label: '가용 자금 (즉시 사용 가능 계좌)', value: won(liquid), kindTag: 'actual', src: `계좌·자산 ${accounts.filter((a) => a.liquid).length}개의 잔액 합계` })}
        ${kpi({ label: `${month} 사업 매출 입금`, value: won(mRevenue), kindTag: 'actual', sub: `매출 외 입금 ${won(mIn - mRevenue)} (지원금·생활비 등, 매출 아님)`, src: 'Finance 수입 중 수입 유형 = 사업 매출' })}
        ${kpi({ label: `${month} 사업 비용 지출`, value: won(mBizOut), kindTag: 'actual', sub: `개인 지출 ${won(mOut - mBizOut)}`, src: 'Finance 지출 중 사업 비용' })}
        ${kpi({ label: `${year}년 누적 사업 순이익`, value: won(yProfit), kindTag: 'actual', negative: yProfit < 0, sub: `매출 ${won(yRevenue)} − 사업비용 ${won(yBizOut)}`, src: '올해 Finance 기록' })}
      </div>

      <h2 class="ledger-title"><span>2</span> 약속 — 아직 내 돈이 아닌 것, 아직 안 나간 돈</h2>
      <div class="cols-2">
        <section class="card section">
          <div class="card-head"><div><h2>받을 돈 · 계약 ${pill(`${open.length}건 ${won(sum(open, (r) => r.amount))}`, overdue.length ? 'bad' : 'info')}</h2><p>입금 전까지는 위 "실제" 숫자에 들어가지 않습니다. ${overdue.length ? `입금 기한 지남 ${overdue.length}건.` : ''}</p></div><button data-new="receivables">추가</button></div>
          ${table([
            { label: '거래처 · 내용', primary: true, cell: (r) => html`<strong>${r.client}</strong><br><span class="muted small">${r.title}</span>` },
            { label: '상태', cell: (r) => pill(label(RECEIVABLE_STATUS, r.status), r.status === 'paid' ? 'good' : r.status === 'cancelled' ? '' : r.due_date && r.due_date < today && r.status === 'invoiced' ? 'bad' : 'warn') },
            { label: '입금 예정', cell: (r) => r.paid_on ?? r.due_date ?? '—' },
            { label: '금액', num: true, cell: (r) => won(r.amount) },
            { label: '', cell: (r) => rowActions('receivables', r) },
          ], receivables, { empty: '계약·청구가 없습니다. 견적서를 보냈거나 계약했다면 여기에 기록하세요.' })}
        </section>
        <section class="card section">
          <div class="card-head"><div><h2>나갈 돈 · 세금 ${pill(`예정 ${won(sum(upcoming, (o) => o.amount))}`, due30.length ? 'warn' : 'good')}</h2><p>30일 안에 낼 돈은 "지금 쓸 수 있는 돈"에서 미리 뺍니다.</p></div><button data-new="obligations">추가</button></div>
          ${table([
            { label: '내용', primary: true, cell: (o) => html`<strong>${o.title}</strong><br><span class="muted small">${label(OBLIGATION_KINDS, o.kind)}${o.estimated ? ' · 추정 금액' : ''}</span>` },
            { label: '상태', cell: (o) => pill(label(OBLIGATION_STATUS, o.status), o.status === 'paid' ? 'good' : o.due_date <= in30 ? 'warn' : 'info') },
            { label: '기한', cell: (o) => o.due_date },
            { label: '금액', num: true, cell: (o) => won(o.amount) },
            { label: '', cell: (o) => rowActions('obligations', o) },
          ], obligations, { empty: '등록된 세금·납부 일정이 없습니다. 아래 "세금 달력"을 참고해 추가하세요.' })}
        </section>
      </div>

      <h2 class="ledger-title"><span>3</span> 예상 — 가설과 전망 (현금 아님)</h2>
      <div class="kpis">
        ${kpi({ label: '진행 중 사업의 예상 월 매출 합', value: won(expected), kindTag: 'expected', sub: '근거와 신뢰도는 Ventures에서', src: '사업·프로젝트의 예상 월 매출. 어떤 실제 합계에도 더하지 않음' })}
        ${kpi({ label: '세금 적립 권장액', value: won(taxReserve), kindTag: 'expected', sub: `올해 사업 순이익 × ${TAX_RESERVE_RATE * 100}% − 올해 낸 세금 ${won(taxPaidThisYear)}`, src: '계획용 가정. 실제 세율은 소득 구간·공제에 따라 다름 → 세무사 확인' })}
      </div>

      <section class="card section">
        <div class="card-head"><div><h2>세금 달력 (개인사업자·프리랜서 기본)</h2><p>날짜가 오면 "나갈 돈"에 추정 금액으로 미리 등록해 두세요. 정확한 금액과 대상 여부는 홈택스·세무사로 확인.</p></div></div>
        ${table([
          { label: '언제', cell: (r) => r[0] },
          { label: '무엇', primary: true, cell: (r) => r[1] },
          { label: '메모', cell: (r) => r[2] },
        ], [
          ['1월 25일', '부가가치세 확정신고 (일반과세자, 하반기분)', '간이과세자는 1월에 1년치'],
          ['5월 31일', '종합소득세 + 지방소득세 신고·납부', '프리랜서 3.3% 원천징수분 정산(환급 또는 추가 납부)'],
          ['7월 25일', '부가가치세 확정신고 (일반과세자, 상반기분)', ''],
          ['11월 30일', '종합소득세 중간예납', '고지서가 나오면 납부'],
          ['매월', '국민연금·건강보험 (지역가입자)', '직장에 다니면 직장에서 처리'],
        ])}
      </section>`,
  };
}

// Korean banks usually export CP949 (EUC-KR); newer ones UTF-8.
function decode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('euc-kr').decode(buf); }
}

export function mount(root, { backend }) {
  const file = root.querySelector('#bi-file');
  const box = root.querySelector('#bi-preview');
  if (!file || !box) return;
  let pending = null;

  const show = (content) => { box.innerHTML = String(content); };

  file.addEventListener('change', async () => {
    pending = null;
    const f = file.files?.[0];
    if (!f) return show('');
    const parsed = parseBankStatement(decode(await f.arrayBuffer()));
    if (parsed.error) return show(html`<div class="empty">${parsed.error}</div>`);
    const account_id = Number(root.querySelector('#bi-account').value);
    const body = { account_id, rows: parsed.transactions, keys: importKeys(parsed.transactions), closing: parsed.closing };
    try {
      const dry = await backend.post('/bank-import', { ...body, dry_run: true });
      pending = body;
      const inc = parsed.transactions.filter((t) => t.direction === 'income');
      const exp = parsed.transactions.filter((t) => t.direction === 'expense');
      const s = (rows) => rows.reduce((n, t) => n + t.amount, 0);
      const c = parsed.cols;
      show(html`
        <p><b>${f.name}</b>: 거래 ${parsed.transactions.length}건 (입금 ${won(s(inc))} · 출금 ${won(s(exp))}),
          새로 추가 <b>${dry.created}건</b>, 이미 있음 ${dry.duplicates}건${parsed.skipped.length ? `, 건너뛴 줄 ${parsed.skipped.length}개 (합계·빈 줄 등)` : ''}.</p>
        <p class="muted small">인식한 열: 날짜 "${c.headers[c.date]}"${c.amount >= 0 ? ` · 금액 "${c.headers[c.amount]}"` : ` · 출금 "${c.headers[c.out] ?? '없음'}" · 입금 "${c.headers[c.in] ?? '없음'}"`} · 잔액 "${c.balance >= 0 ? c.headers[c.balance] : '없음'}" · 내용 "${c.description >= 0 ? c.headers[c.description] : '없음'}"</p>
        <p>${parsed.closing ? html`가져오면 이 계좌 잔액을 <b>${won(parsed.closing.balance)}</b> (${parsed.closing.as_of} 기준, 은행 내역 검증)으로 바꿉니다.` : '파일에 잔액 열이 없어 계좌 잔액은 바꾸지 않습니다.'}</p>
        ${table([
          { label: '날짜', cell: (t) => t.date },
          { label: '내용', primary: true, cell: (t) => t.description || '—' },
          { label: '구분', cell: (t) => (t.direction === 'income' ? '입금' : '출금') },
          { label: '금액', num: true, cell: (t) => won(t.amount) },
          { label: '잔액', num: true, cell: (t) => (t.balance === null ? '—' : won(t.balance)) },
        ], parsed.transactions.slice(0, 8))}
        <div style="display:flex;gap:8px;margin-top:10px">
          <button id="bi-go" ${dry.created || parsed.closing ? '' : 'disabled'}>${dry.created}건 가져오기</button>
          <button id="bi-cancel" class="link">취소</button>
        </div>`);
    } catch (err) {
      show(html`<div class="empty">${err.message}</div>`);
    }
  });

  box.addEventListener('click', async (e) => {
    if (e.target.id === 'bi-cancel') { file.value = ''; pending = null; return show(''); }
    if (e.target.id !== 'bi-go' || !pending) return;
    e.target.disabled = true;
    try {
      const r = await backend.post('/bank-import', pending);
      toast(`${r.created}건 가져옴 · 중복 ${r.duplicates}건 건너뜀${r.balanceUpdated ? ' · 잔액 갱신(검증)' : ''}`);
      window.dispatchEvent(new Event('oo:reload'));
    } catch (err) {
      toast(err.message, true);
      e.target.disabled = false;
    }
  });
}
