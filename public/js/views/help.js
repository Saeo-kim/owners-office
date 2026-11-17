// Help & Guide. Professional finance tools (QuickBooks, Xero, Korean
// 세무·회계 프로그램) all ship a help centre and in-context "?" links; a
// documented workflow reads as more professional, not less. This page is the
// office manual: the monthly close, where each record belongs, and terms.
import { html, raw } from '../ui.js';

const row = (cells) => html`<tr>${cells.map((c) => html`<td>${raw(c)}</td>`)}</tr>`;
const grid = (head, rows) => html`<div class="table-wrap"><table class="pb-table"><thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${rows.map(row)}</tbody></table></div>`;

export async function render() {
  return {
    title: 'Help & Guide',
    body: html`<div class="pb-body">
      <section class="card section pb-section">
        <div class="card-head"><div><h2>이 사무실의 업무 흐름</h2><p>회계 담당자가 일하는 순서 그대로: 기록 → 분류 → 대사(맞춰 보기) → 마감 → 보고.</p></div></div>
        ${grid(['단계', '하는 일', '어디서', '언제'], [
          ['1 기록', '입금·출금을 빠짐없이 적는다. 영수증·청구서는 파일 위치를 메모에', '<a href="#/finance">Finance</a> · <a href="#/cash">Cash Desk</a>', '돈이 움직인 날'],
          ['2 분류', '사업/개인, 고정/변동, 매출/매출 외 수입', 'Finance 입력 폼', '기록할 때'],
          ['3 약속 관리', '계약·청구(받을 돈), 세금·카드값(나갈 돈)', '<a href="#/cash">Cash Desk</a> 2구역', '계약·고지서를 받은 날'],
          ['4 대사', '앱의 계좌 잔액 = 은행 앱 잔액인지 확인. 다르면 빠진 거래가 있음', 'Finance → 계좌·자산', '매월 말'],
          ['5 마감', '이번 달 매출·비용·순이익 확정, 구독 정리', '<a href="#/dashboard">Executive Dashboard</a>', '매월 말 1시간'],
          ['6 보고·판단', '목표 대비 실적, 자동 감사, 다음 달 결정', '<a href="#/goals">Strategy & Goals</a> · <a href="#/audit">Audit</a> · <a href="#/playbook">Playbook</a>', '매월 말 · 매주 금'],
        ])}
      </section>

      <section class="card section pb-section">
        <div class="card-head"><div><h2>월말 마감 체크리스트</h2></div></div>
        <ol class="pb-list">
          <li>은행·카드 앱을 열고 이번 달 거래를 Finance와 한 줄씩 맞춘다.</li>
          <li>모든 계좌의 잔액과 기준일을 갱신한다 (계좌·자산).</li>
          <li>받을 돈 중 입금된 것: Finance에 수입으로 기록 → 받을 돈은 "입금 완료".</li>
          <li>다음 달 납부할 세금·카드값을 "나갈 돈"에 등록한다.</li>
          <li>Employees(구독·기기)에서 이번 달 안 쓴 것을 해지 검토로.</li>
          <li>Executive Dashboard에서 사업 순이익을 확인하고 Goals에 기록.</li>
          <li>Audit &amp; Review의 "높음" 항목을 처리한다.</li>
          <li>설정 → 백업 파일 내려받기 (또는 데이터 백업 스크립트).</li>
        </ol>
      </section>

      <section class="card section pb-section">
        <div class="card-head"><div><h2>이 숫자는 어디에 속하나</h2><p>회계 기록(실제 돈)과 사업 성과 지표(활동)를 섞지 않는 것이 이 앱의 첫 번째 규칙입니다.</p></div></div>
        ${grid(['상황', '기록할 곳', '실제 돈에 포함?'], [
          ['고객이 입금했다', 'Finance 수입 (사업 매출)', '<strong>예</strong>'],
          ['계약서에 서명했다 / 청구서를 보냈다', 'Cash Desk 받을 돈', '아니오 (입금될 때까지)'],
          ['다음 달 이만큼 팔릴 것 같다', 'Ventures 예상 월 매출 (근거·신뢰도 필수)', '아니오'],
          ['정부 지원금·생활비를 받았다', 'Finance 수입 (지원금/생활비 지원)', '현금은 맞지만 <strong>매출 아님</strong>'],
          ['구독료가 나갔다', 'Finance 지출 + Employees 월 유지비', '예'],
          ['세금 고지서가 왔다', 'Cash Desk 나갈 돈', '납부할 때 Finance 지출로'],
          ['작업을 3시간 했다', 'Productivity', '아니오 (시간은 돈이 아님)'],
        ])}
      </section>

      <section class="card section pb-section">
        <div class="card-head"><div><h2>용어</h2></div></div>
        ${grid(['용어', '뜻'], [
          ['매출', '사업으로 고객에게 받은 돈. 지원금·용돈은 매출이 아님'],
          ['순이익 (사업)', '사업 매출 − 사업 비용. 개인 지출은 빼지 않음'],
          ['현금흐름', '실제로 계좌에 들어오고 나간 돈의 흐름. 이익이 나도 현금이 마를 수 있음'],
          ['현금주의 / 발생주의', '돈이 움직인 날 기준 / 거래가 생긴 날(계약·청구) 기준. 이 앱의 "실제"는 현금주의'],
          ['미수금 (받을 돈)', '일은 했지만 아직 못 받은 돈'],
          ['가용 자금', '즉시 쓸 수 있는 계좌 잔액 합 (적금·투자 제외)'],
          ['버틸 수 있는 기간 (runway)', '가용 자금 ÷ 최근 평균 월 순지출'],
          ['세금 적립', '나중에 낼 세금을 미리 떼어 두는 돈. 쓰면 안 되는 돈'],
        ])}
      </section>

      <section class="card section pb-section">
        <div class="card-head"><div><h2>Help 페이지가 있어도 되나?</h2></div></div>
        <p>QuickBooks, Xero 같은 회계 소프트웨어와 국내 세무·회계 프로그램은 모두 도움말 센터, 화면별 "?" 안내, 월말 마감 가이드를 제공합니다. 금융 도구에서 문서화된 절차는 비전문적이 아니라 <strong>신뢰의 근거</strong>입니다. 다만 도움말은 화면을 가리지 않도록 별도 메뉴(여기)와 각 화면의 "근거" 표시로 나눴습니다.</p>
      </section>
    </div>`,
  };
}
