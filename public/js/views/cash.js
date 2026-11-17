// Cash Desk: real money first. Three strictly separated zones:
//   1. 실제 (actual)   – money that moved in or out of an account, and balances
//   2. 약속 (promised) – contracts and invoices not yet paid, taxes not yet due
//   3. 예상 (estimate) – venture forecasts and hypotheses
// Nothing from zone 2 or 3 is ever added to a zone-1 number.
import { RECEIVABLE_STATUS, OBLIGATION_KINDS, OBLIGATION_STATUS } from '../../core/enums.js';
import { html, kind, kpi, label, pill, rowActions, table, won } from '../ui.js';

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
