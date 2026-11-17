// CEO Playbook: the weekly health check (live numbers from this office) and
// strategy notes for each business idea. Strategy text is guidance, not data:
// nothing here is added to any total. "Ventures에 등록" opens the normal form.
import { html, pill, raw, won, num } from '../ui.js';
import { TABS2, VIEWS2 } from './playbook2.js';

const TABS = [
  ['health', '회사 건강 점검'],
  ['direction', '내 방향 점검'],
  ['academy', 'Academy 수익화'],
  ['online', '비대면 강의'],
  ['human', '사람 선생님 × AI'],
  ['music', 'AI 음악 수익화'],
];

const ventureButton = (preset) => html`<button class="primary" data-new="ventures" data-preset="${JSON.stringify(preset)}">Ventures에 등록해서 추적하기</button>`;

const section = (title, body, sub = '') => html`<section class="card section pb-section"><div class="card-head"><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ''}</div></div>${body}</section>`;
const list = (items) => html`<ul class="pb-list">${items.map((i) => html`<li>${raw(i)}</li>`)}</ul>`;
const steps = (items) => html`<ol class="pb-list">${items.map((i) => html`<li>${raw(i)}</li>`)}</ol>`;
const grid = (head, rows) => html`<div class="table-wrap"><table class="pb-table"><thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${raw(c)}</td>`)}</tr>`)}</tbody></table></div>`;

// ── 1. 회사 건강 점검 ─────────────────────────────────────
const WEEKLY = [
  ['money', '이번 주 들어온 돈(사업 매출)을 Finance에 전부 기록했다'],
  ['spend', '이번 주 나간 돈과 구독료를 기록했고, 안 쓰는 구독은 해지 검토에 올렸다'],
  ['one', '이번 주 "가장 중요한 한 가지"가 무엇이었는지 한 문장으로 말할 수 있다'],
  ['user', '내가 만든 것을 실제로 써 본 사람과 이번 주에 한 번 이상 대화했다'],
  ['output', 'Productivity에 작업 시간과 결과물(링크·파일)을 남겼다'],
  ['ventures', '진행 중 프로젝트가 한도 이하다 (넘으면 하나를 보류로)'],
  ['audit', 'Audit & Review의 "높음" 항목을 모두 읽고, 하나는 조치했다'],
  ['next', '다음 주 할 일 3개를 정했다 (Focus_Flow에 등록)'],
  ['learn', '이번 주 배운 것 하나를 Engineering Academy에 Capture했다'],
  ['rest', '쉬는 날을 하루 이상 지켰다 (지친 대표가 가장 큰 경영 위험)'],
];

function weekKey() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `pb-week-${d.toISOString().slice(0, 10)}`;
}
function loadChecks() {
  try {
    return JSON.parse(localStorage.getItem(weekKey()) ?? '{}');
  } catch {
    return {};
  }
}

function light(tone, text) {
  return pill(text, tone);
}

async function health(backend, status) {
  const d = await backend.get('/analysis/dashboard');
  const revenue = d.current.income.business_revenue ?? 0;
  const bizCost = d.current.expense.business ?? 0;
  const net = revenue - bizCost;
  const active = d.ventures.length;
  const limit = status.settings.max_active_ventures;
  const high = d.alerts.filter((a) => a.severity === 'high').length;
  const medium = d.alerts.filter((a) => a.severity === 'medium').length;
  const r = d.runway;

  const signals = [
    {
      name: '돈이 들어오나 (이번 달 사업 매출)',
      tone: revenue > 0 ? 'good' : 'warn',
      value: won(revenue),
      say: revenue > 0 ? '매출이 있습니다. 다음 질문: 지난달보다 늘었나?' : '아직 0원. 초기에는 정상이지만, "첫 1만 원"이 가장 중요한 다음 목표입니다.',
    },
    {
      name: '남는 돈 (사업 매출 − 사업 비용)',
      tone: net >= 0 ? 'good' : revenue > 0 ? 'warn' : 'serious',
      value: won(net),
      say: net >= 0 ? '사업이 스스로 비용을 감당합니다.' : '비용이 매출보다 큽니다. Employees(구독·기기)에서 줄일 것을 찾으세요.',
    },
    {
      name: '버틸 수 있는 기간 (자금 소진 예상)',
      tone: r.status === 'positive' ? 'good' : r.status === 'no_data' ? 'info' : r.months >= 6 ? 'good' : r.months >= 3 ? 'warn' : 'bad',
      value: r.status === 'burning' ? `${num(r.months, 1)}개월` : r.status === 'positive' ? '흑자' : '데이터 없음',
      say: r.status === 'no_data' ? 'Finance에 계좌 잔액과 3개월 거래를 넣으면 계산됩니다. 이 숫자를 모르는 것이 가장 위험합니다.' : r.status === 'burning' && r.months < 3 ? '3개월 미만: 새 일을 멈추고 매출·비용부터.' : '여유가 있습니다. 6개월 아래로 내려가면 경고.',
    },
    {
      name: '동시에 벌인 일 (진행 중 프로젝트)',
      tone: active <= limit ? 'good' : 'bad',
      value: `${active} / 한도 ${limit}`,
      say: active <= limit ? '집중하고 있습니다.' : '너무 많이 벌였습니다. 매출에 가장 가까운 하나만 남기고 나머지는 "보류".',
    },
    {
      name: '자동 감사 경고',
      tone: high ? 'bad' : medium ? 'warn' : 'good',
      value: `높음 ${high} · 보통 ${medium}`,
      say: high ? 'Audit & Review에서 "높음"부터 처리하세요.' : '큰 경고는 없습니다.',
    },
  ];

  const checks = loadChecks();
  const done = WEEKLY.filter(([k]) => checks[k]).length;

  return html`
    ${section('지금 회사 상태: 신호등 5개', html`
      <div class="pb-signals">${signals.map((s) => html`<div class="pb-signal"><div class="pb-signal-top"><strong>${s.name}</strong>${light(s.tone, s.value)}</div><p>${s.say}</p></div>`)}</div>
      ${d.includesDemo ? html`<div class="source">DEMO 데이터가 섞여 있습니다. 실제 판단 전에 설정에서 데모를 삭제하세요.</div>` : html`<div class="source">${d.month} 기준. 이 화면의 숫자는 Finance·Ventures·Audit에 기록된 실제 데이터만 사용합니다.</div>`}`,
      '회사가 잘 돌아가는지는 이 5개로 봅니다. 초록이 아닌 것 하나만 이번 주에 고치세요.')}
    ${section(`이번 주 점검표 (${done} / ${WEEKLY.length})`, html`
      <div class="pb-checks" id="pb-checks">${WEEKLY.map(([k, t]) => html`<label class="pb-check"><input type="checkbox" data-check="${k}" ${checks[k] ? html`checked` : ''}><span>${t}</span></label>`)}</div>
      <div class="source">매주 금요일 30분. 체크는 이 브라우저에만 저장되고 매주 월요일 새로 시작합니다. 7개 이상이면 잘 운영되고 있는 주입니다.</div>`,
      '"뭘 해야 할지 모르겠다"의 답: 매주 이 10줄을 하면 됩니다.')}
    ${section('대표의 리듬: 언제 무엇을 보나', grid(['주기', '시간', '할 일'], [
      ['매일', '5분', '오늘 할 일 3개 (Focus_Flow) · 쓴 돈 기록'],
      ['매주 금', '30분', '이 페이지 점검표 · Audit "높음" 처리 · 다음 주 3개'],
      ['매월 말', '1시간', 'Strategy & Goals 목표 대비 실적 · 구독 정리 · 사업별 손익 비교 → 하나 멈추고 하나 키우기'],
      ['분기', '반나절', '"이 사업을 지금 처음 시작한다면 할 것인가?" 아니면 종료. 내 방향 점검 탭 다시 읽기'],
    ]))}
    ${section('회사가 나락 가는 신호 7개 (하나라도 해당되면 멈추고 보기)', list([
      '<strong>통장 잔고를 모른다.</strong> 숫자를 모르면 위험을 못 봅니다. → Finance에 계좌 등록',
      '<strong>3개월째 매출 0원인데 새 프로젝트를 시작한다.</strong> → 신규 금지, 기존 것 하나를 팔아 보기',
      '<strong>쓰는 사람이 나 혼자다.</strong> 만들기만 하고 보여 주지 않음 → 이번 주 1명에게 보여 주기',
      '<strong>구독료가 매출보다 크다.</strong> → Employees에서 "해지 검토"',
      '<strong>"다음 주에 하면 돼"가 4주째다.</strong> → 일을 30분 단위로 쪼개기',
      '<strong>예상 매출을 실제처럼 말한다.</strong> → 이 앱은 예상과 실제를 절대 섞지 않습니다. 실제만 믿기',
      '<strong>잠·운동·쉬는 날이 무너졌다.</strong> 1인 회사의 유일한 직원은 나입니다.',
    ]))}`;
}

// ── 2. 내 방향 점검 ───────────────────────────────────────
function direction() {
  return html`
    ${section('솔직한 진단: "느리지만 확장성 큰 방식"에 대해', html`
      <p>지금 저장소를 보면 SAEO LABS, THE EXPANSION, Lingua Space, Engineering Academy, Owner's Office, Focus_Flow, Global Tech Radar, freelance-manager까지 <strong>8개를 동시에</strong> 만들고 있습니다. 각각의 설계(확장성)는 좋습니다. 문제는 속도가 아니라 <strong>"쓰는 사람이 아직 없다"</strong>는 것입니다.</p>
      ${grid(['지금 방식의 장점 (지키기)', '답답한 부분 (바꾸기)'], [
        ['구조를 먼저 생각한다. 나중에 안 갈아엎어도 된다.', '완성 기준이 "내 마음에 들 때"라서 끝이 안 난다'],
        ['기록을 남긴다 (Academy, Office, Focus_Flow)', '도구를 만드는 데 시간이 가고, 도구로 하는 일(공부·판매)이 밀린다'],
        ['AI를 잘 활용해 혼자서 큰 규모를 만든다', '시장 반응(돈, 피드백)을 받기 전에 다음 것을 시작한다'],
      ])}
      <h3 class="pb-h3">처방: 이번 달 규칙 3개</h3>
      ${steps([
        '<strong>새 프로젝트 금지 30일.</strong> 아이디어는 Ventures에 "아이디어" 단계로만 적어 둔다.',
        '<strong>하나에 사용자 5명.</strong> Engineering Academy를 같은 반 5명에게 쓰게 하고, 일주일 뒤 "계속 쓸래?" 묻기. (시험 기간이라 지금이 최적기)',
        '<strong>시간 비율 뒤집기:</strong> 만들기 70% · 보여주기 30% → 만들기 30% · 보여주기/묻기/공부 70%.',
      ])}
      <p>방식을 버릴 필요는 없습니다. <strong>"확장성 있게 만든다"는 유지하고, "작게 내보낸다"만 추가</strong>하면 됩니다. 확장성은 쓰는 사람이 생긴 다음에 가치가 생깁니다.</p>`)}
    ${section('AI 강사 vs 내가 직접 가르치기?', html`
      <p><strong>둘 중 하나를 고를 필요가 없습니다.</strong> 추천은 세 번째 길입니다: <strong>AI가 설명하고, 내가 "이해했는지"를 확인해 주는 사람</strong>이 되는 것.</p>
      ${list([
        '대면 강의를 할 용기는 필요 없습니다. 녹화 + 텍스트 Q&A + 짧은 음성 피드백으로 충분합니다 (비대면 강의 탭).',
        '나의 진짜 강점: <strong>"같은 내용을 계속 이해 못 했던 경험"</strong>. 잘하는 선생님은 초보가 어디서 막히는지 잊어버립니다. 나는 기억합니다. 코드 해부실은 그 경험에서 나온 제품입니다.',
        '그래서 지금 할 일은 가르치기 연습이 아니라, <strong>내가 막혔던 곳을 기록하는 것</strong>입니다. JPA 시험 공부가 곧 콘텐츠 제작입니다.',
      ])}`)}
    ${section('자동으로 피드백 받는 방법 (추천 순)', grid(['방법', '무엇을 알려주나', '비용'], [
      ['<strong>이 Office의 자동 감사</strong> (이미 있음)', '동시 진행 과다, 근거 없는 예상 매출, 구독 낭비, 정체 프로젝트', '0원 · 데이터만 입력'],
      ['<strong>금요일 점검표</strong> (회사 건강 점검 탭)', '이번 주 운영이 제대로 됐는지 10줄', '0원 · 30분'],
      ['<strong>Claude 주간 리뷰 예약</strong>', '매주 정해진 시간에 GitHub 커밋, Focus_Flow 진행, 이 Office 데이터를 읽고 "이번 주 잘한 것 / 멈출 것 / 다음 한 가지" 피드백. Claude Code의 /schedule로 예약 가능', '구독 내'],
      ['<strong>사용자 5명</strong>', '진짜 피드백. 어떤 자동화보다 정확함', '0원 · 용기 조금'],
      ['<strong>월 1회 사람 멘토</strong>', '현직자(학원 선생님, 선배)에게 Office 대시보드 화면을 보여 주고 15분 질문', '커피값'],
    ]))}`;
}

// ── 3. Engineering Academy 수익화 ────────────────────────
function academy() {
  return html`
    ${section('무엇을 파는가', html`
      <p><strong>"설명"이 아니라 "이해했는지 확인"을 판다.</strong> 설명은 유튜브·AI가 무료로 무한히 합니다. 국비학원·부트캠프 수강생이 돈을 내는 이유는 "나만 모르는 것 같은 불안"을 없애고 시험·면접을 통과하기 위해서입니다.</p>
      ${list([
        '핵심 기능: 코드 해부실(모르는 줄을 단어 단위로), Explain it back(설명해 보면 채점), 간격 복습, 시험형 문제.',
        '타깃: 비전공 국비 과정 수강생 (나와 같은 사람). 가장 아픈 시점 = 과정 중간 시험, 파이널 프로젝트, 취업 면접 직전.',
      ])}`)}
    ${section('수익 모델 4단계 (순서대로)', grid(['단계', '모델', '가격 가설', '검증 기준'], [
      ['1. 지금', '무료 + 사용자 5명 (같은 반)', '0원', '5명 중 3명이 2주간 주 3회 이상 사용'],
      ['2. 콘텐츠', '시험 대비 팩 (JPA, SQL, 컴퓨터 기본) – 내가 직접 쓴 해설 + 문제', '팩당 9,900~19,900원', '사전 신청 20명'],
      ['3. 코호트', '4주 "막힘 해결반": 앱 + 주 1회 라이브 Q&A + 과제 피드백 (비대면 강의 탭)', '1인 15~30만원, 10명', '1기 완주율 70%'],
      ['4. B2B', '학원에 선생님용 대시보드 (학생별 막힌 개념)', '학원당 월 정액', '학원 1곳 무료 파일럿'],
    ]))}
    ${section('⚠ 반드시 지킬 것', list([
      '<strong>학원 자료(선생님의 자습서, defect-lab 코드, 전자책)는 판매 콘텐츠에 넣으면 안 됩니다.</strong> 선생님의 저작물입니다. 개인 공부용으로만 쓰고, 팔 것은 내가 직접 쓴 설명·문제·예제로 만드세요. 지금 Academy의 커리큘럼은 개인 학습 노트입니다.',
      '로그인·결제를 붙이기 전에 사용자 5명을 먼저 확보 (만들기 전에 팔아 보기).',
      '학생 데이터(이름, 점수)는 개인정보. B2B 단계 전에 개인정보 처리방침 필요.',
    ]))}
    ${section('다음 행동', html`${steps([
      '이번 주: 같은 반 5명에게 "JPA 시험 전에 코드 해부실 써 볼래?" 메시지 보내기',
      'Academy 서버를 반 친구들이 쓰게 하려면: README의 공개 실행(ACADEMY_PASSWORD 필수) 참고',
      '2주 뒤: 사용 횟수 확인 → "시험 팩을 9,900원에 판다면 살래?" 질문',
    ])}<div class="toolbar">${ventureButton({ name: 'Engineering Academy', stage: 'validation', status: 'active', summary: '국비·부트캠프 수강생용 "이해 확인" 학습 앱. 코드 해부실 + 설명 채점 + 시험 팩.', note: '1단계: 같은 반 5명 사용 검증' })}</div>`)}`;
}

// ── 4. 비대면 강의 ────────────────────────────────────────
function online() {
  return html`
    ${section('대면 강의의 장점을 비대면에 전부 옮기는 법', grid(['대면의 장점', '비대면에서 대신하는 방법', '오히려 나은 점'], [
      ['손 들고 바로 질문', '질문 게시판 24시간 내 답변 약속 + 주 2회 30분 라이브 Q&A (카메라 끄고 화면+목소리만)', '질문이 글로 남아 FAQ 자산이 됨'],
      ['선생님이 표정 보고 "막혔구나" 눈치챔', '매주 진단 퀴즈 + Explain it back 점수 60 미만 학생을 자동으로 찾아 <strong>내가 먼저</strong> DM', '감이 아니라 데이터로 놓치는 학생이 없음'],
      ['강의실에 가야 하는 강제성', '4주 기수제 + 매주 금요일 과제 마감 + 출석 = 과제 제출', '시간·장소 자유'],
      ['옆자리 동료', '기수 디스코드 채널 + 2인 스터디 짝꿍 + 주 1회 서로 코드 리뷰', '전국에서 모임'],
      ['화면 짚어 주며 설명', '학생 코드에 5분짜리 녹화 피드백 영상 (내 화면 + 목소리)', '학생이 반복 재생 가능'],
      ['선생님과의 관계·신뢰', '1주차 1:1 15분 웰컴 콜(음성), 4주차 수료 데모데이(온라인 발표)', '-'],
    ]), '"비대면이라 부족하다"가 아니라 "비대면이라 더 촘촘하다"를 상품으로.')}
    ${section('불안하지 않게: 작은 단계로 올라가기', grid(['단계', '하는 일', '불안 수준'], [
      ['0', '얼굴 없이 화면 + 목소리로 10분 강의 1개 녹화. 아무에게도 안 보여줌', '거의 없음'],
      ['1', '녹화 강의 3개를 같은 반 5명에게만 공유 (편집으로 실수 지우기 가능)', '낮음'],
      ['2', '무료 베타 기수 5명: 녹화 강의 + 텍스트 Q&A만 (라이브 없음)', '낮음'],
      ['3', '라이브 Q&A 30분 시작. 미리 받은 질문만 답하기 + 대본 메모', '보통'],
      ['4', '유료 1기 10명. 베타 후기를 소개글에', '보통 → 익숙해짐'],
    ]))}
    ${section('강의 1개 만드는 틀 (10분)', steps([
      '오프닝 30초: "오늘 끝나면 ___를 설명할 수 있다"',
      '막힌 장면 1분: 내가 실제로 막혔던 코드·에러 화면 (내 강점)',
      '비유 1분 → 한 장 그림 2분 → 코드 한 줄씩 3분',
      '흔한 오해 3개 1분 → 따라 하기 과제 1분',
      '마무리 30초: "이해했는지 Academy에서 Explain it back으로 확인하세요"',
    ]))}
    ${section('수익화 경로', html`${grid(['상품', '가격 가설', '역할'], [
      ['유튜브/블로그 "코드 한 줄 해부" 쇼츠', '무료', '신뢰 쌓기, 대기 명단 모으기'],
      ['VOD 강의 (인프런·클래스101 등 플랫폼 또는 자체)', '3~5만원', '반복 수익 (만들어 두면 계속 팔림)'],
      ['4주 코호트 막힘 해결반', '15~30만원 · 10명', '핵심 매출 + 후기'],
      ['1:1 코드 리뷰 (비동기 영상)', '회당 3~5만원', '프리미엄'],
    ])}<div class="source">가격은 검증 전 가설입니다. 실제 매출이 생기면 Finance에 "사업 매출"로 기록하세요.</div>
      <div class="toolbar">${ventureButton({ name: '비대면 강의 (막힘 해결반)', stage: 'idea', status: 'active', summary: '얼굴 없는 녹화 강의 + 텍스트 Q&A + 데이터 기반 막힘 감지. Engineering Academy와 결합.', note: '0단계: 화면+목소리 10분 강의 1개 녹화' })}</div>`)}`;
}

// ── 5. 사람 선생님 × AI ──────────────────────────────────
function human() {
  return html`
    ${section('가설: AI가 아무리 가르쳐도, 못 알아들으면 사람을 찾는다', html`
      <p>맞는 관찰입니다. AI는 설명을 <strong>무한히</strong> 할 수 있지만, 학생이 "어디서부터 모르는지"를 스스로 말하지 못하면 같은 설명만 반복합니다. 그리고 "이제 됐다"고 <strong>책임지고 말해 주는 사람</strong>을 원합니다. 교실 로봇은 멀었지만, 이 역할은 지금 당장 비대면으로 팔 수 있습니다.</p>
      ${grid(['AI(앱)가 맡는 것', '사람(나)이 맡는 것'], [
        ['설명을 수십 번, 다른 비유로', '어디서 막혔는지 진단 ("getReviews는 아는데 LAZY부터 모르는구나")'],
        ['연습 문제, 채점, 복습 일정', '60초 설명을 듣고 "이해했다" 확인해 주기 (이해 보증)'],
        ['밤 2시 질문 대답', '포기하려는 순간의 동기 · 관계 · 진로 이야기'],
        ['코드 단어 하나하나 해부', 'AI가 틀린 설명을 했을 때 바로잡기'],
      ])}`)}
    ${section('상품 이름 예시: "이해 보증반"', html`${list([
      '규칙: 앱에서 Explain it back 60점을 넘긴 개념만 사람(나)에게 "60초 설명" 녹음을 제출 → 내가 듣고 OK / 다시.',
      '사람의 시간은 "확인"에만 쓰므로 1명이 30~50명을 맡을 수 있음 (설명은 AI가 함).',
      '비대면·비동기: 녹음 듣고 텍스트/음성으로 답장. 얼굴, 실시간 필요 없음.',
      '학원·부트캠프에 "보조 강사" 서비스로 B2B 확장 가능.',
    ])}<div class="toolbar">${ventureButton({ name: '이해 보증반 (사람 × AI)', stage: 'idea', status: 'active', summary: 'AI가 설명·연습·채점, 사람이 막힘 진단과 이해 확인을 책임지는 비대면 학습 서비스.', note: 'Engineering Academy + 비대면 강의와 같은 고객' })}</div>`)}`;
}

// ── 6. AI 음악 ────────────────────────────────────────────
function music() {
  return html`
    ${section('먼저 알아야 할 저작권 현실 (2026년 기준, 발매 전 최신 규정 재확인)', html`${list([
      '<strong>AI가 혼자 만든 부분은 저작권 보호를 받기 어렵습니다.</strong> 한국 저작권위원회 안내와 미국 저작권청 보고서 모두 "인간의 창작적 기여"가 있는 부분만 보호합니다.',
      '<strong>보호받는 것: 내가 쓴 가사, 내가 만든 멜로디·편곡 수정, 여러 결과물을 고르고 배열·편집한 창작적 선택.</strong> → 사람 몫을 최대한 키우는 것이 전략입니다.',
      '<strong>한국음악저작권협회(KOMCA)</strong>는 AI가 만든 부분이 들어간 곡의 신탁 등록을 제한하고 있습니다 (등록 시 AI 사용 여부 확인). 등록 전 협회에 직접 확인하세요.',
      '<strong>Suno·Udio 같은 생성 서비스</strong>는 보통 유료 요금제에서만 상업적 이용을 허용합니다. 약관이 자주 바뀌고 음반사와의 소송·합의로 정책이 변하는 중이니, 곡을 만든 날의 약관과 요금제를 캡처해 보관하세요.',
      '<strong>유통사·스트리밍 플랫폼</strong>은 AI 사용 표시를 요구하거나 대량 생성곡을 제한하는 추세입니다. 숨기지 말고 표시하세요.',
    ])}<div class="source">법률 자문이 아닙니다. 실제 등록·계약 전에는 저작권위원회(무료 상담)나 협회에 확인하세요.</div>`)}
    ${section('저작권을 챙기는 작업 방식', steps([
      '<strong>가사는 직접 쓴다.</strong> AI는 아이디어 브레인스토밍만. 가사는 어문저작물로 확실히 보호됩니다. 가사 초안 버전을 날짜별로 저장.',
      '<strong>멜로디·코드 진행에 내 손을 넣는다.</strong> 허밍 녹음, 피아노 롤에서 직접 수정, 구간 재배열.',
      '<strong>생성물은 재료로, 완성은 DAW에서.</strong> 여러 생성 결과에서 고르고 자르고 섞고 내 녹음(목소리, 악기)을 더한다.',
      '<strong>작업 기록을 남긴다:</strong> 프롬프트, 생성 번호, 사용 요금제, 가사 버전, DAW 프로젝트 파일, 날짜 → 폴더 하나에. 분쟁 시 "사람이 무엇을 했는지"의 증거.',
      '<strong>등록:</strong> 가사·편곡 등 내 기여분을 한국저작권위원회에 저작권 등록 (AI 사용 사실을 정확히 기재).',
    ]))}
    ${section('돈이 되는 경로', html`${grid(['경로', '방식', '주의'], [
      ['맞춤 곡 제작', '생일·결혼·가게 징글·유튜버 인트로를 주문 제작 (가사는 내가)', '가장 빨리 첫 매출. 계약서에 AI 사용 명시'],
      ['배경음악 라이선스', '유튜버·매장용 BGM 팩 판매', '플랫폼별 AI 정책 확인'],
      ['스트리밍 발매', '유통사 통해 멜론·스포티파이 등', '수익은 작음. 포트폴리오 용도'],
      ['AI 작곡 워크플로 강의', '"저작권 챙기는 AI 작곡법" (비대면 강의 탭과 같은 방식)', '강의는 내 저작물이라 가장 안전'],
    ])}<div class="toolbar">${ventureButton({ name: 'AI 음악 (사람 가사 + AI 편곡)', stage: 'idea', status: 'active', summary: '직접 쓴 가사 + AI 생성 재료 + DAW 편집. 맞춤 곡 제작으로 첫 매출, 작업 기록으로 저작권 증빙.', note: '첫 행동: 지인 1명에게 맞춤 생일 노래 제작' })}</div>`)}`;
}

export async function render({ backend, query, status }) {
  const all = [...TABS, ...TABS2];
  const tab = all.some(([k]) => k === query.tab) ? query.tab : 'health';
  const views = { health: () => health(backend, status), direction, academy, online, human, music, ...VIEWS2 };
  const body = await views[tab]();
  return {
    title: 'CEO Playbook',
    body: html`<nav class="pb-tabs" aria-label="플레이북 주제"><span class="pb-tabs-label">운영</span>${TABS.map(([k, l]) => html`<a href="#/playbook?tab=${k}" ${k === tab ? html`aria-current="page"` : ''}>${l}</a>`)}</nav>
      <nav class="pb-tabs" aria-label="사업 전략과 원칙"><span class="pb-tabs-label">전략·원칙</span>${TABS2.map(([k, l]) => html`<a href="#/playbook?tab=${k}" ${k === tab ? html`aria-current="page"` : ''}>${l}</a>`)}</nav>
      <div class="pb-body">${body}</div>`,
  };
}

export function mount(root) {
  root.querySelector('#pb-checks')?.addEventListener('change', (e) => {
    const key = e.target.dataset.check;
    if (!key) return;
    const checks = loadChecks();
    checks[key] = e.target.checked;
    try {
      localStorage.setItem(weekKey(), JSON.stringify(checks));
    } catch {
      /* checks then last for this page view only */
    }
    const head = root.querySelector('#pb-checks')?.closest('.card')?.querySelector('h2');
    if (head) head.textContent = `이번 주 점검표 (${Object.values(checks).filter(Boolean).length} / ${WEEKLY.length})`;
  });
}
