// CEO Playbook, second set of tabs (2026-11-17). Strategy notes only:
// numbers here are hypotheses unless marked 실제, and nothing is added to totals.
import { html, raw } from '../ui.js';

const ventureButton = (preset, label = 'Ventures에 등록해서 추적하기') => html`<button class="primary" data-new="ventures" data-preset="${JSON.stringify(preset)}">${label}</button>`;
const section = (title, body, sub = '') => html`<section class="card section pb-section"><div class="card-head"><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ''}</div></div>${body}</section>`;
const list = (items) => html`<ul class="pb-list">${items.map((i) => html`<li>${raw(i)}</li>`)}</ul>`;
const steps = (items) => html`<ol class="pb-list">${items.map((i) => html`<li>${raw(i)}</li>`)}</ol>`;
const grid = (head, rows) => html`<div class="table-wrap"><table class="pb-table"><thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${raw(c)}</td>`)}</tr>`)}</tbody></table></div>`;
const hypothesis = html`<div class="source">가설 · 검증 전 숫자입니다. 실제 입금이 생기면 Finance에 기록하고, 그때부터 "실제"로 봅니다.</div>`;

export const TABS2 = [
  ['portfolio', '내 제품 4개'],
  ['ai-business', '나만의 AI 사업'],
  ['promo', 'Academy 홍보 영상'],
  ['self-study', '독학 교육 상품'],
  ['parttime', '직장 병행 로드맵'],
  ['roles', '역할과 전문가'],
  ['policy', '운영 원칙'],
  ['efficiency', '비효율 점검'],
];

// ── 내 제품 4개 ─────────────────────────────────────────
function portfolio() {
  return html`
    ${section('제품별 상태와 돈 되는 길 (2026-11-17 기준)', grid(['제품', '지금 상태 (실제)', '가장 가까운 매출 경로', '첫 행동'], [
      ['<strong>Engineering Academy</strong><br>학습 앱', '로컬 앱 완성, 사용자 1명(나), 매출 0원', '국비·부트캠프 수강생 대상 시험 대비 팩 + 4주 코호트', '같은 반 5명에게 사용 요청'],
      ['<strong>Owner\'s Office</strong><br>1인 사업 경영 앱', '로컬·웹 모드 완성, GitHub Pages 배포 구조 있음, 매출 0원', '1인 사업자·프리랜서용 "현금 장부" 템플릿 판매 또는 무료 공개로 신뢰 확보', '내 실제 데이터로 한 달 써 보고 스크린샷 확보'],
      ['<strong>Lingua Space</strong><br>언어 학습 PWA', 'Render 배포 구조(PostgreSQL), PWA 지원, 매출 0원', '한국어 학습자(외국인) 대상, 무료 + 프리미엄 단어장', '실사용자 1명 확보 (언어교환 커뮤니티)'],
      ['<strong>The Expansion</strong><br>지식 백과 사이트', '백과 26개 항목 (Bash 추가), 정적 사이트, 매출 0원', '콘텐츠 → 검색 유입 → Academy·강의로 연결하는 "입구"', '배포 후 Google Search Console 등록'],
    ]), '네 제품은 따로 팔기보다 하나의 흐름으로: Expansion(무료 지식, 유입) → Academy(이해 확인, 유료) → 강의(코호트). Office와 Lingua는 별도 시장.')}
    ${section('우선순위 판단', html`${list([
      '<strong>1순위 Engineering Academy</strong>: 고객(나와 같은 수강생)에게 바로 닿을 수 있고, 시험이라는 마감이 구매 이유를 만든다.',
      '<strong>2순위 The Expansion</strong>: 돈은 직접 안 되지만 Academy의 입구. 유지비가 거의 0원(정적 사이트).',
      '<strong>보류 Lingua Space, Owner\'s Office 판매</strong>: 시장이 다르고 지금 집중을 나눈다. Office는 내 회사 운영 도구로 계속 쓰기.',
    ])}<div class="toolbar">
      ${ventureButton({ name: 'The Expansion', stage: 'building', status: 'active', summary: '무료 개발 지식 백과. Academy와 강의로 연결하는 유입 채널.', note: '배포 + Search Console 등록' }, 'The Expansion 등록')}
      ${ventureButton({ name: 'Lingua Space', stage: 'building', status: 'paused', summary: '언어 학습 PWA (Render 배포). 다른 시장이라 보류.', note: '재개 조건: Academy 첫 매출 이후' }, 'Lingua Space 등록')}
      ${ventureButton({ name: "Owner's Office (내부 도구)", stage: 'building', status: 'active', summary: '내 회사의 현금·업무 관리 도구. 판매는 보류, 내 운영에 사용.', note: '한 달 실사용 후 판매 여부 결정' }, "Owner's Office 등록")}
    </div>${hypothesis}`)}`;
}

// ── 나만의 AI 사업 ─────────────────────────────────────
function aiBusiness() {
  return html`
    ${section('현실 점검: "Claude 같은 AI를 직접 만든다"는 것', html`
      <p>Claude·GPT급 범용 모델을 처음부터 학습시키는 데는 수천억 원 단위의 컴퓨팅과 대규모 연구 조직이 듭니다. 1인 사업이 이길 수 있는 게임이 아닙니다. <strong>돈을 버는 AI 회사의 대부분은 모델을 만들지 않고, 모델 위에 "특정 사람의 특정 문제"를 푸는 시스템을 만듭니다.</strong></p>
      ${grid(['층', '누가 만드나', '나의 선택'], [
        ['1. 기반 모델 (Claude, GPT, Gemini, 오픈 모델)', '빅테크·연구소', '<strong>빌려 쓴다</strong> (API, 사용량만큼 지불)'],
        ['2. 도구·검색·기억 (RAG, 도구 호출, 데이터베이스)', '개발자', '<strong>직접 만든다</strong> ← 내 기술이 쌓이는 곳'],
        ['3. 도메인 지식·평가 기준 (무엇이 좋은 답인가)', '그 분야를 아는 사람', '<strong>직접 만든다</strong> ← 경쟁자가 따라 하기 어려운 곳'],
        ['4. 고객·신뢰·데이터', '사업자', '<strong>직접 쌓는다</strong> ← 회사의 진짜 자산'],
      ])}
      <p>"AI 의존이 걱정된다"의 해답도 여기 있습니다. 모델은 빌리되, <strong>2·3·4층을 내가 소유</strong>하면 나는 AI 사용자가 아니라 AI 시스템의 주인입니다.</p>`)}
    ${section('내가 이길 수 있는 제품: "AI 코드 학습 튜터" (Academy 확장)', html`${list([
      '<strong>차별점 1 · 이해 확인</strong>: 범용 AI는 설명만 한다. 내 제품은 Explain-back 채점·간격 복습으로 "이해했는지"를 측정한다 (이미 구현됨).',
      '<strong>차별점 2 · 막힘 데이터</strong>: 수강생들이 어떤 단어에서 막히는지(코드 해부실 클릭 기록)가 쌓이면, 그 자체가 아무도 없는 데이터셋이 된다.',
      '<strong>차별점 3 · 한국 국비 과정 맞춤</strong>: 커리큘럼·시험 형식이 정해져 있어서 범용 AI보다 정확하게 맞출 수 있다.',
      '<strong>차별점 4 · 사람 보증</strong>: 사람 선생님 × AI 탭의 "이해 보증반".',
    ])}`)}
    ${section('직접 익힐 기술 (순서대로)', steps([
      '<strong>LLM API 호출</strong>: Claude API로 메시지 보내고 받기, 스트리밍, 토큰 비용 계산.',
      '<strong>프롬프트 설계와 평가</strong>: 같은 질문 50개로 답의 품질을 자동 채점하는 평가 세트 (이게 차별화의 핵심).',
      '<strong>RAG</strong>: 내 커리큘럼 문서를 검색해서 답에 근거로 붙이기 (임베딩, 벡터 검색).',
      '<strong>도구 호출 (tool use)</strong>: AI가 Academy DB를 조회하고 퀴즈를 만들게 하기.',
      '<strong>운영</strong>: 비용 상한, 개인정보 마스킹, 남용 방지, 로그.',
    ]))}
    ${section('비용과 수익 구조 (가설)', html`${grid(['항목', '규모 (가설)', '메모'], [
      ['개발비', '내 시간 + 월 수만 원', '모델을 학습시키지 않으므로 GPU 비용 없음'],
      ['운영비: 모델 API', '사용자당 월 수백~수천 원', '작은 모델로 채점, 큰 모델은 어려운 설명에만. 캐싱으로 절감'],
      ['운영비: 서버', '월 1~3만 원', '소규모 클라우드 / Render'],
      ['수익: 개인 구독', '월 9,900~19,900원', '시험 기간에 수요 집중'],
      ['수익: 학원 B2B', '학원당 월 정액', '선생님용 "막힘 대시보드"가 판매 포인트'],
    ])}
      <p><strong>손익 규칙</strong>: 사용자 1명의 월 API 비용이 구독료의 20%를 넘지 않게 설계. 넘으면 기능을 줄이는 것이 아니라 모델 크기·캐싱을 조정.</p>
      <div class="toolbar">${ventureButton({ name: 'AI 코드 학습 튜터 (Academy AI)', stage: 'idea', status: 'active', summary: 'Claude API 위에 Academy의 이해 확인·막힘 데이터·국비 커리큘럼을 얹은 학습 튜터. 모델은 빌리고 평가 기준·데이터·고객은 소유.', note: '1단계: Academy 사용자 5명 → 2단계: AI 해설 기능 실험(비용 측정) → 3단계: 유료 구독 실험' })}</div>${hypothesis}`)}
    ${section('확장 경로', steps([
      '<strong>0→1</strong>: 사용자 5명이 2주간 주 3회 사용 (지금 단계).',
      '<strong>1→10</strong>: AI 해설 기능을 붙이고 사용자당 비용 측정. 사전 결제 10명.',
      '<strong>10→100</strong>: 학원 1곳 파일럿, 강의 코호트와 묶음 판매.',
      '<strong>100→</strong>: 막힘 데이터로 모델 평가 기준 고도화, 다른 과목(SQL, React)으로 확장.',
    ]))}`;
}

// ── 홍보 영상 ─────────────────────────────────────────
function promo() {
  return html`
    ${section('무엇이 홍보할 가치가 있나', html`${list([
      '<strong>"코드 한 줄에 마우스를 올리면 설명이 뜨고, 클릭하면 더 깊이 들어간다"</strong>: 10초 안에 보여 줄 수 있는 유일한 장면. 영상의 주인공.',
      '<strong>"다시 읽기 대신 설명해 보기"</strong>: Explain-back 점수 13점 → 재시도 72점 같은 변화 장면.',
      '<strong>"선생님 없이도 막힌 곳을 정확히 안다"</strong>: 국비 수강생이 가장 아파하는 지점.',
    ])}`, '누구를 위해: 비전공 국비·부트캠프 수강생, 독학 개발자. 해결하는 문제: "읽으면 아는데 설명을 못 하는" 상태, 모르는 단어 때문에 코드 전체를 포기하는 것.')}
    ${section('60초 영상 대본 (얼굴 없이 화면 + 목소리)', grid(['시간', '화면', '말'], [
      ['0–5초', '`store.getReviews().size();` 한 줄만 크게', '"이 한 줄, 설명할 수 있나요?"'],
      ['5–15초', '단어에 마우스 → 설명, 클릭 → 더 깊이 → 뒤로', '"모르는 단어는 누르면 됩니다. 막힌 곳까지 내려갔다가 언제든 돌아옵니다."'],
      ['15–30초', 'Explain-back: 13점 → 재시도 72점, 코치 메시지', '"읽는 대신 설명해 보세요. 점수가 이해한 만큼을 보여 줍니다."'],
      ['30–45초', '커리큘럼, 복습 카드', '"잊기 직전에 다시 떠올리게 해 줍니다."'],
      ['45–60초', '로고 + 무료 체험 링크', '"국비 과정 시험 2주 전, 무료로 써 보세요."'],
    ]))}
    ${section('시청자 → 사용자 → 유료 고객', html`${steps([
      '영상 설명란에 <strong>무료 체험 링크 1개</strong>만 (선택지가 많으면 아무것도 안 누름).',
      '체험 첫 화면 = 영상에 나온 그 코드 한 줄 (기대한 것을 바로 보여 줌).',
      '사용 3일째: "JPA 시험 팩" 안내 (시험 일정과 연결).',
      '측정: 조회수 → 체험 시작 → 3일 사용 → 결제. 각 단계 전환율을 Office Ventures 메모에 기록.',
    ])}${grid(['채널', '형식', '비용'], [
      ['유튜브 쇼츠 / 인스타 릴스', '15~60초 화면 녹화', '0원'],
      ['국비 과정 커뮤니티·오픈채팅', '시험 기간 무료 체험 안내', '0원'],
      ['블로그 (The Expansion)', '"N+1 한 줄로 이해하기" 글 + 영상 삽입', '0원'],
    ])}<div class="toolbar">${ventureButton({ name: 'Academy 홍보 영상', stage: 'idea', status: 'active', summary: '얼굴 없는 60초 화면 녹화 영상. 코드 해부실 장면이 핵심. 시청 → 체험 → 시험 팩 결제 퍼널.', note: '첫 행동: OBS로 60초 대본 녹화, 쇼츠 1개 업로드' })}</div>${hypothesis}`)}`;
}

// ── 독학 교육 상품 ───────────────────────────────────
function selfStudy() {
  return html`
    ${section('전통 강의가 남기는 빈칸 = 상품 기회', grid(['수업에서 해결 안 되는 것', '상품', '형태'], [
      ['`Review.store` 같은 표기를 아무도 설명 안 함', '"코드 읽는 법" 해설집: 표기·기호·어노테이션을 처음 보는 사람 기준으로', 'PDF/웹 + Academy 팩'],
      ['선생님 그림을 이해 못 해도 다시 물어보기 어려움', '개념별 "한 장 그림" 모음 + 그림 읽는 법', '이미지 카드'],
      ['외울 것과 이해할 것 구분이 없음', '과목별 외울 것/이해할 것/찾아볼 것 지도', '1장 요약'],
      ['시험이 어떤 형식인지 모름', '형식별 모의 문제 (코드 읽기·서술·실습)', 'Academy 퀴즈 팩'],
      ['막힌 걸 혼자 풀 방법이 없음', '코드 해부실 + 막힘 질문 템플릿', '앱 기능'],
    ]))}
    ${section('원칙', html`${list([
      '<strong>모든 상품은 내가 직접 쓴 설명·예제로</strong>. 학원 자료를 옮기지 않는다 (운영 원칙 탭).',
      '내가 실제로 막혔던 지점이 곧 목차. 공부 기록이 그대로 제작 과정이 된다.',
      '처음 상품은 작게: JPA 연관관계 "코드 읽는 법" 1편 → 반응 보고 확장.',
    ])}<div class="toolbar">${ventureButton({ name: '독학용 개발 교재 (코드 읽는 법)', stage: 'idea', status: 'active', summary: '전통 강의가 설명하지 않는 표기·그림·외울 것 구분을 처음 배우는 사람 기준으로 푼 교재. Academy 팩과 함께 판매.', note: '1편: JPA 연관관계 표기 (Review.store)' })}</div>${hypothesis}`)}`;
}

// ── 직장 병행 로드맵 ─────────────────────────────────
function partTime() {
  return html`
    ${section('원칙: 월급이 생활비, 사업은 "시간이 덜 드는 돈"부터', list([
      '<strong>직장을 그만두지 않는다</strong>: 사업 순이익이 6개월 연속 생활비의 50%를 넘기 전까지.',
      '<strong>주 8시간 예산</strong>: 평일 저녁 2회 × 2시간 + 주말 4시간. 넘으면 지속 불가능.',
      '<strong>유지비 상한</strong>: 모든 제품의 월 유지비 합 ≤ 지난 3개월 평균 사업 매출. 매출이 0원이면 유지비도 0원에 가깝게 (무료 티어·정적 호스팅).',
      '<strong>자동화 우선</strong>: 같은 일을 세 번 했으면 스크립트나 봇으로.',
    ]))}
    ${section('단계별 로드맵', grid(['단계', '기간', '목표 (실제 돈 기준)', '하는 일', '자동화'], [
      ['0. 정리', '~2026-12', '유지비 확인, 매출 0원 인정', '제품 4개 중 1개 집중, Cash Desk에 실제 계좌 등록', 'CI 봇, 데이터 백업 스크립트'],
      ['1. 첫 1만 원', '~2027-02', '실제 입금 1건', 'Academy 시험 팩 사전 판매 또는 맞춤 곡 1건', '결제 링크 하나 (수작업 OK)'],
      ['2. 월 10만 원', '~2027-06', '3개월 연속 입금', '영상 주 1개, 코호트 베타 1기', '영상 업로드 일정, 신청 폼 자동 정리'],
      ['3. 월 50만 원', '~2027-12', '유지비의 5배 이상', '유료 코호트 정기화, 학원 1곳 파일럿', '수강생 진도 알림, 주간 리포트 자동'],
      ['4. 선택', '2028~', '사업 순이익 ≥ 생활비 50% × 6개월', '직장 축소 여부 결정', ''],
    ]))}
    ${section('하지 않을 것', list([
      '매출 없이 유료 서버·유료 도구를 늘리는 것',
      '네 제품을 동시에 키우는 것',
      '"예상 매출"을 근거로 직장을 그만두는 것',
    ]))}`;
}

// ── 역할과 전문가 ───────────────────────────────────
function roles() {
  return html`
    ${section('1인 회사의 역할표: 누가 무엇을 책임지나', grid(['역할', '책임', 'AI가 도울 수 있는 것', '사람(나)이 결정', '자격 있는 전문가 필요'], [
      ['경영 책임자 (Business Manager)', '무엇을 하고 무엇을 안 할지', '선택지 비교, 회의록', '<strong>모든 최종 결정</strong>', '—'],
      ['회계 담당 (Accountant)', '모든 입출금을 빠짐없이 기록·분류, 영수증 보관', '분류 제안, 누락 점검, 월말 정리 체크', '분류 확정', '장부 작성 대행은 필요 시 세무사'],
      ['재무 분석 (Financial Analyst)', '현금흐름·손익·버틸 기간 분석', '추세 분석, 시나리오', '투자·지출 판단', '—'],
      ['세무 (Tax Specialist)', '신고 기한, 세금 적립, 경비 인정 여부', '기한 알림, 일반 개념 설명', '자료 준비', '<strong>세무사</strong>: 신고 대리, 절세 판단, 사업자 유형 선택'],
      ['영업 (Sales)', '고객 찾기, 견적·계약, 입금 확인', '제안서 초안, 후속 메일', '가격, 계약 조건', '계약 분쟁 시 <strong>변호사</strong>'],
      ['마케팅 (Marketing)', '누구에게 무엇을 어떻게 알릴지', '대본, 썸네일 문구, 게시 일정', '메시지와 브랜드', '—'],
      ['프로젝트 관리 (PM)', '일정, 우선순위, 막힘 해소', 'Focus_Flow 정리, 주간 리포트', '우선순위', '—'],
      ['소프트웨어 엔지니어', '제품 구현·테스트·배포', '코드 작성, 테스트, CI 봇', '설계 결정, 검증', '—'],
      ['보안 담당 (Security)', '비밀번호·개인정보·접근 권한', '코드 점검, 설정 검토', '사고 대응 결정', '개인정보 대량 처리 시 전문가 검토'],
    ]), 'Focus_Flow에는 이미 "AI 좌석"과 부서(재무·회계 FINANCE_ACCOUNTING 포함)가 있습니다. 관리자 화면 → 멤버 초대에서 종류 AI, 부서 FINANCE_ACCOUNTING, 직함 "회계 담당"으로 추가하면 됩니다. 새 기능을 만들 필요가 없어 기존 구조를 그대로 씁니다.')}
    ${section('AI에게 맡기면 안 되는 것 (면허·법적 책임)', html`${list([
      '<strong>세금 신고서 제출과 그 내용의 책임</strong>: 본인 또는 세무사. AI 답은 참고용.',
      '<strong>사업자 등록 유형(간이/일반), 경비 처리 범위</strong>: 금액이 걸린 판단은 세무사 1회 상담(수만 원대)이 가장 싼 보험.',
      '<strong>계약서 최종 검토</strong>: 금액이 크면 변호사.',
      '<strong>회계 감사·공식 재무제표</strong>: 공인회계사 영역 (1인 사업 초기에는 보통 불필요).',
    ])}<p>언제 세무사를 부르나: <strong>첫 매출이 생긴 해의 종합소득세 신고 전</strong>, 또는 연 매출이 일정 규모를 넘어 장부 작성 의무가 바뀔 때.</p>`)}`;
}

// ── 운영 원칙 ─────────────────────────────────────────
function policy() {
  return html`
    ${section('운영 원칙 1: 교육 자료를 다루는 법', html`
      <p>이 원칙은 회사의 정책입니다. Focus_Flow는 개인 앱이어도 나중에 팀원·AI 좌석이 함께 쓰고, 화면을 캡처해 홍보하고, 백업이 클라우드로 올라갑니다. "개인용"이라는 경계는 생각보다 쉽게 무너집니다.</p>
      ${grid(['자료 종류', '예', '저장해도 되나', '공개·판매'], [
        ['강사 배포 원본', '자습서 HTML, defect-lab 코드, 전자책, 슬라이드', '내 PC의 학원 폴더에만 (원본 그대로)', '<strong>불가</strong>. 업로드·재배포·판매 금지'],
        ['저작권 있는 교재·강의', '책, 유료 강의 영상, 캡처', '개인 공부용 메모만', '<strong>불가</strong>'],
        ['내 공부 노트', '수업을 듣고 내가 쓴 요약', '어디든 (Academy, Focus_Flow)', '원문 문장·그림·예제를 옮긴 부분은 공개 불가'],
        ['내 설명·요약', '내 말과 내 비유로 다시 쓴 개념 설명', '어디든', '<strong>가능</strong> (출처 개념만 언급)'],
        ['내 예제·구현', '내가 직접 만든 코드, 내 프로젝트', '어디든', '<strong>가능</strong>'],
        ['공개 자료', '공식 문서, 오픈소스 (라이선스 준수)', '어디든', '라이선스대로'],
      ])}
      <h3 class="pb-h3">규칙</h3>
      ${steps([
        '<strong>원본은 올리지 않는다, 지식은 내 것으로 다시 쓴다.</strong> Focus_Flow에는 강사 파일 대신 "무엇을 언제 공부할지"와 "내 요약"만.',
        '파일이 필요하면 <strong>링크나 경로</strong>만 적는다 (예: "파이널 폴더의 자습서 사건 3").',
        '판매·공개 콘텐츠에는 학원 자료의 문장, 그림, 예제 코드, 문제를 쓰지 않는다. 같은 개념을 내 예제로 새로 만든다.',
        '애매하면 강사에게 묻는다: "수업 자료를 개인 학습 앱에 요약해서 정리해도 될까요?" 묻는 것 자체가 신뢰를 쌓는다.',
        '현재 상태 점검: Engineering Academy의 JPA 커리큘럼은 자습서를 바탕으로 한 <strong>개인 학습 노트</strong>입니다. 판매 전에는 내 예제로 다시 써야 합니다.',
      ])}`, '이 원칙의 위치: 사업 정책이므로 Owner\'s Office(여기). Academy와 Focus_Flow는 이 탭을 참조합니다.')}
    ${section('운영 원칙 2: 미션·목표는 어디에 적나 (중복 없이)', grid(['무엇', '어디', '누가 보나', '얼마나 자주 바뀌나'], [
      ['회사 미션 (왜 이 회사가 존재하나, 한 문단)', '<strong>SAEO LABS 웹사이트</strong>', '고객·외부', '거의 안 바뀜'],
      ['사업별 목표·숫자·결정 (매출 목표, 집중/보류)', '<strong>Owner\'s Office</strong> (Strategy & Goals, Ventures)', '대표(나)', '매월'],
      ['프로젝트별 "왜 하는가" (Purpose)', '<strong>Focus Flow</strong> 프로젝트 정보의 Purpose 칸', '일하는 사람 (나, AI 좌석)', '프로젝트 시작 때'],
      ['개념별 "왜 필요한가"', '<strong>Engineering Academy</strong> 각 기록의 Why is it needed?', '공부하는 나', '기록할 때'],
    ]), '같은 문장을 여러 곳에 복사하지 않습니다. Focus Flow의 Purpose는 Office의 목표 이름을 한 줄로 가리키고, 세부 숫자는 Office에만 둡니다.')}
    ${section('운영 원칙 3: 돈', list([
      '실제·약속·예상을 절대 섞지 않는다 (Cash Desk의 1·2·3 구역).',
      '입금되기 전의 돈으로 지출 결정을 하지 않는다.',
      '사업 통장과 개인 통장을 분리한다 (첫 매출 전에).',
      '세금은 매출이 들어올 때 미리 떼어 둔다.',
    ]))}
    ${section('운영 원칙 4: AI', list([
      'AI는 직원이지 결정권자가 아니다. 돈·법·고객 데이터 관련 결정은 사람이.',
      'AI가 만든 코드는 1층(소유) 부분을 내가 설명할 수 있을 때만 배포한다 (Academy: "Claude의 답, 어디까지 배워야 하나").',
      '고객 개인정보를 외부 AI에 그대로 넣지 않는다.',
    ]))}`;
}

// ── 비효율 점검 ─────────────────────────────────────
function efficiency() {
  return html`
    ${section('지금 방식에서 바로 고칠 것 (2026-11-17 관찰)', grid(['비효율', '왜 손해인가', '더 나은 방법', '절약', '자동화?'], [
      ['한 메시지에 요청 19개', 'AI의 주의·컨텍스트가 항목마다 얇아지고, 결과 확인도 한 번에 못 함. 하나가 막히면 전체가 늦어짐', '주제별 3~5개씩 세션 분리, 세션마다 완료 확인', '확인 시간 절반, 재작업 감소', '아니오 (습관)'],
      ['매번 폴더 경로·프로젝트 설명', '반복 타이핑 + 엉뚱한 사본 수정 위험', '워크스페이스 레지스트리 (CLAUDE.md, workspace.json)', '요청당 1~3분', '<strong>완료</strong>'],
      ['같은 프로젝트 사본 여러 개 (dev-playground, 백업 폴더들)', '어느 게 최신인지 헷갈림, 옛 사본을 고칠 위험', '원본 = SAEO-WORKSPACE + GitHub. 옛 사본은 확인 후 보관 폴더로', '혼란 제거', '아니오 (한 번 정리)'],
      ['제품 8개 동시 개발', '어느 것도 사용자에게 닿지 않음', '1개 집중 (내 제품 4개 탭)', '주 수 시간', '아니오'],
      ['학습: 같은 내용 다시 읽기', '읽기는 "안다는 느낌"만 늘림', 'Explain-back, 코드 해부실, 복습 카드', '공부 시간 대비 기억량', '<strong>Academy에 구현</strong>'],
      ['노트북 교체 대비 없음', '데이터 손실 위험 (DB 파일은 Git에 없음)', '주간 자동 백업 + clone 스크립트', '교체 시 하루 → 1시간', '<strong>스크립트 완료</strong>, 작업 스케줄러 등록은 선택'],
      ['테스트를 손으로 돌림', '깜빡하면 깨진 코드가 쌓임', 'GitHub Actions CI 봇', 'push마다 자동', '<strong>완료</strong>'],
    ]))}
    ${section('앞으로의 규칙', list([
      '요청은 "목표 1개 + 완료 기준"으로 시작한다.',
      '같은 일을 세 번 하면 자동화를 요청한다.',
      'Claude가 더 나은 방법을 알면 먼저 말하게 한다 (전역 CLAUDE.md에 기록함).',
    ]))}`;
}

export const VIEWS2 = { portfolio, 'ai-business': aiBusiness, promo, 'self-study': selfStudy, parttime: partTime, roles, policy, efficiency };
