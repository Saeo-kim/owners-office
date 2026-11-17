// Demo data. Every row is stored with is_demo = 1, shown with a DEMO badge,
// and can be removed in one step. Dates are relative to `now` so the demo
// always looks current. Amounts come from a fixed-seed generator so tests
// see the same numbers on every run.
import { ValidationError } from './repository.js';
import { addDays, addMonths, daysInMonth, isoDate, monthOf } from './dates.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function seedDemo(repo, now = new Date()) {
  const counts = repo.counts();
  if (Object.values(counts).some((c) => c.demo > 0)) throw new ValidationError({ _: '이미 데모 데이터가 있습니다. 먼저 삭제하세요.' });
  const today = isoDate(now);
  const thisMonth = monthOf(today);
  const rand = rng(20261117);
  const vary = (base, pct = 0.25) => Math.round((base * (1 - pct + rand() * pct * 2)) / 1000) * 1000;
  const day = (month, d) => `${month}-${String(Math.min(d, daysInMonth(month))).padStart(2, '0')}`;
  const notFuture = (date) => date <= today;

  return repo.tx(() => {
    let n = 0;
    const add = (name, input) => {
      n++;
      return repo.create(name, input, { demo: true });
    };

    // Accounts
    add('accounts', { name: '[DEMO] 사업용 통장', kind: 'bank', balance: 4_350_000, liquid: true, as_of: today });
    add('accounts', { name: '[DEMO] 비상금 통장', kind: 'savings', balance: 6_000_000, liquid: true, as_of: today });
    add('accounts', { name: '[DEMO] 장기 투자 계좌', kind: 'investment', balance: 9_200_000, liquid: false, as_of: addDays(today, -60) });

    // Employees (products and services)
    const E = {};
    const emp = (key, input) => (E[key] = add('employees', { started_on: addDays(today, -400), ...input }));
    emp('laptop', { name: '[DEMO] 업무용 노트북', department: 'operations', kind: 'device', role: '주 작업 장비', duties: '개발, 문서 작성, 강의 녹화', monthly_cost: 0, purchase_price: 2_400_000, useful_life_months: 48, usage_frequency: 'daily', contribution: 5, satisfaction: 5, monthly_value: 400_000, value_basis: '없으면 모든 매출 활동이 멈춤. 대여 시 월 40만원 수준' });
    emp('phone', { name: '[DEMO] 스마트폰', department: 'operations', kind: 'device', role: '고객 연락·인증', duties: '고객 응대, 2단계 인증, 촬영', monthly_cost: 0, purchase_price: 1_350_000, useful_life_months: 36, usage_frequency: 'daily', contribution: 4, satisfaction: 4, monthly_value: 60_000, value_basis: '고객 연락 채널 유지' });
    emp('tablet', { name: '[DEMO] 태블릿', department: 'strategy', kind: 'device', role: '아이디어 스케치', duties: '기획 메모, 영상 시청', monthly_cost: 0, purchase_price: 990_000, useful_life_months: 36, usage_frequency: 'rarely', contribution: 2, satisfaction: 4, monthly_value: 5_000, value_basis: '최근 한 달 업무 사용 2회' });
    emp('mobile', { name: '[DEMO] 모바일 요금제', department: 'operations', kind: 'telecom', role: '통신', duties: '데이터, 통화', monthly_cost: 69_000, usage_frequency: 'daily', contribution: 4, satisfaction: 3, monthly_value: 45_000, value_basis: '같은 사용량의 알뜰 요금제는 월 3만원대', overlap_group: '' });
    emp('internet', { name: '[DEMO] 가정용 인터넷', department: 'operations', kind: 'telecom', role: '네트워크', duties: '재택 근무 회선', monthly_cost: 33_000, usage_frequency: 'daily', contribution: 5, satisfaction: 4, monthly_value: 100_000, value_basis: '재택 근무 전제 조건' });
    emp('aiA', { name: '[DEMO] AI 어시스턴트 구독 A', department: 'bizdev', kind: 'ai', role: '리서치·코딩 보조', duties: '코드 리뷰, 강의 자료 초안', monthly_cost: 29_000, usage_frequency: 'daily', contribution: 5, satisfaction: 5, monthly_value: 300_000, value_basis: '주 5시간 절약 × 시간가치 2만원 × 3주', overlap_group: 'AI 어시스턴트' });
    emp('aiB', { name: '[DEMO] AI 어시스턴트 구독 B', department: 'bizdev', kind: 'ai', role: '리서치 보조', duties: '검색, 요약', monthly_cost: 29_000, usage_frequency: 'weekly', contribution: 2, satisfaction: 4, monthly_value: 15_000, value_basis: 'A로 대체 가능한 작업이 대부분', overlap_group: 'AI 어시스턴트' });
    emp('editor', { name: '[DEMO] 코드 에디터 Pro', department: 'operations', kind: 'devtool', role: '개발 환경', duties: '개발', monthly_cost: 13_000, usage_frequency: 'daily', contribution: 4, satisfaction: 4 });
    emp('vps', { name: '[DEMO] 클라우드 서버', department: 'operations', kind: 'cloud', role: '서비스 호스팅', duties: 'SaaS 시제품, 강의 사이트', monthly_cost: 32_000, usage_frequency: 'daily', contribution: 4, satisfaction: 3, monthly_value: 80_000, value_basis: '강의 사이트 매출의 전제' });
    emp('design', { name: '[DEMO] 디자인 툴 구독', department: 'bizdev', kind: 'software', role: '썸네일·상세페이지', duties: '마케팅 이미지', monthly_cost: 17_000, usage_frequency: 'weekly', contribution: 3, satisfaction: 4 });
    emp('notes', { name: '[DEMO] 노트 앱 프리미엄', department: 'strategy', kind: 'software', role: '기록', duties: '회의록', monthly_cost: 9_900, usage_frequency: 'rarely', contribution: 1, satisfaction: 2, monthly_value: 0, value_basis: '무료 메모 앱으로 대체 중' });
    emp('accounting', { name: '[DEMO] 간편 장부 앱', department: 'finance', kind: 'software', role: '장부·세금 신고 준비', duties: '증빙 정리', monthly_cost: 11_000, usage_frequency: 'monthly', contribution: 3, satisfaction: 3, monthly_value: 30_000, value_basis: '세무 대행 비용 일부 대체' });

    // Ventures
    const V = {};
    V.freelance = add('ventures', { name: '[DEMO] 프리랜서 외주 개발', summary: '중소기업 웹 개발 외주', stage: 'revenue', status: 'active', started_on: addDays(today, -500), expected_monthly_revenue: 2_000_000, forecast_basis: '진행 중 계약 1건 월 150만원 + 유지보수 계약 1건 월 50만원', forecast_confidence: 'high' });
    V.course = add('ventures', { name: '[DEMO] 온라인 강의', summary: '입문자용 웹 개발 강의 판매', stage: 'revenue', status: 'active', started_on: addDays(today, -240), expected_monthly_revenue: 2_500_000, forecast_basis: '수강생 증가 추세', forecast_confidence: 'medium' });
    V.saas = add('ventures', { name: '[DEMO] SaaS 사이드 프로젝트', summary: '소상공인 예약 관리 도구', stage: 'building', status: 'active', started_on: addDays(today, -150), expected_monthly_revenue: 3_000_000, forecast_basis: '', forecast_confidence: 'medium' });
    V.youtube = add('ventures', { name: '[DEMO] 개발 유튜브 채널', summary: '강의 유입용 채널', stage: 'launched', status: 'active', started_on: addDays(today, -200) });
    V.ebook = add('ventures', { name: '[DEMO] 전자책 출판', summary: '취업 준비 전자책', stage: 'idea', status: 'paused', started_on: addDays(today, -90) });

    // Transactions: six months up to today
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(thisMonth, -i);
      const tx = (input) => notFuture(input.date) && add('transactions', input);
      tx({ date: day(m, 10), direction: 'income', amount: vary(1_500_000, 0.05), income_type: 'business_revenue', venture_id: V.freelance.id, description: '[DEMO] 외주 개발 월 정산' });
      if (i < 4) tx({ date: day(m, 25), direction: 'income', amount: 500_000, income_type: 'business_revenue', venture_id: V.freelance.id, description: '[DEMO] 유지보수 계약' });
      tx({ date: day(m, 15), direction: 'income', amount: vary(450_000, 0.4), income_type: 'business_revenue', venture_id: V.course.id, description: '[DEMO] 강의 판매 정산' });
      tx({ date: day(m, 1), direction: 'income', amount: 500_000, income_type: 'living_support', description: '[DEMO] 가족 생활비 지원' });
      tx({ date: day(m, 5), direction: 'expense', amount: 450_000, scope: 'personal', cost_nature: 'fixed', cost_class: 'living', description: '[DEMO] 월세' });
      tx({ date: day(m, 20), direction: 'expense', amount: vary(620_000), scope: 'personal', cost_nature: 'variable', cost_class: 'living', description: '[DEMO] 식비·생활용품' });
      for (const key of ['mobile', 'internet', 'aiA', 'aiB', 'editor', 'vps', 'design', 'notes', 'accounting']) {
        const e = E[key];
        tx({ date: day(m, 3 + (e.id % 20)), direction: 'expense', amount: e.monthly_cost, scope: 'business', cost_nature: 'fixed', cost_class: 'product_service', employee_id: e.id, venture_id: key === 'vps' ? V.saas.id : null, description: `[DEMO] ${e.name.replace('[DEMO] ', '')} 유지비` });
      }
      tx({ date: day(m, 18), direction: 'expense', amount: vary(180_000, 0.5), scope: 'business', cost_nature: 'variable', cost_class: 'marketing', venture_id: V.course.id, description: '[DEMO] 강의 광고비' });
      if (i % 2 === 0) tx({ date: day(m, 22), direction: 'expense', amount: 300_000, scope: 'business', cost_nature: 'variable', cost_class: 'labor', venture_id: V.youtube.id, description: '[DEMO] 영상 편집 외주 (인건비)' });
      tx({ date: day(m, 12), direction: 'expense', amount: vary(40_000), scope: 'business', cost_nature: 'variable', cost_class: 'operating', venture_id: V.saas.id, description: '[DEMO] 도메인·API 사용료' });
    }
    add('transactions', { date: day(addMonths(thisMonth, -3), 8), direction: 'income', amount: 2_000_000, income_type: 'grant', description: '[DEMO] 청년 창업 지원금 1차' });
    add('transactions', { date: day(addMonths(thisMonth, -1), 28), direction: 'income', amount: 120_000, income_type: 'business_revenue', description: '[DEMO] 기술 블로그 원고료 (사업 미지정)' });

    // Goals and plans
    const year = thisMonth.slice(0, 4);
    const lastMonth = addMonths(thisMonth, -1);
    const g1 = add('goals', { title: '[DEMO] 이번 달 사업 매출 300만원', period_type: 'monthly', period: thisMonth, metric: 'business_revenue', target_value: 3_000_000 });
    const g2 = add('goals', { title: '[DEMO] 이번 달 작업 100시간', period_type: 'monthly', period: thisMonth, metric: 'work_hours', target_value: 100 });
    const g3 = add('goals', { title: '[DEMO] 이번 달 총지출 200만원 이하', period_type: 'monthly', period: thisMonth, metric: 'expense_cap', target_value: 2_000_000 });
    add('goals', { title: '[DEMO] 지난달 강의 매출 80만원', period_type: 'monthly', period: lastMonth, metric: 'business_revenue', target_value: 800_000, venture_id: V.course.id });
    const g5 = add('goals', { title: `[DEMO] ${year}년 사업 순이익 1,500만원`, period_type: 'yearly', period: year, metric: 'net_profit', target_value: 15_000_000 });
    const g6 = add('goals', { title: '[DEMO] 강의 누적 수강생 50명', period_type: 'monthly', period: thisMonth, metric: 'custom', target_value: 50, unit: '명', manual_actual: 34, venture_id: V.course.id });
    const plan = (goal, title, offset, status, minutes) => add('plans', { goal_id: goal.id, title, due_date: addDays(today, offset), status, planned_minutes: minutes });
    plan(g1, '[DEMO] 외주 신규 견적 2건 발송', -5, 'done', 240);
    plan(g1, '[DEMO] 강의 할인 이벤트 공지', -2, 'doing', 120);
    plan(g1, '[DEMO] 유지보수 계약 연장 제안', 6, 'todo', 60);
    plan(g2, '[DEMO] 하루 4시간 집중 블록 확보', 10, 'doing', null);
    plan(g3, '[DEMO] 해지 검토 대상 정리', 3, 'todo', 60);
    plan(g5, '[DEMO] 분기별 손익 점검', 40, 'todo', 120);
    plan(g6, '[DEMO] 수강 후기 이벤트', -1, 'todo', 90);

    // Work logs: last 45 days
    const tasks = [
      [V.freelance, 'build', '[DEMO] 고객사 관리자 화면 개발', '관리자 화면 배포', 180],
      [V.freelance, 'sales', '[DEMO] 고객 미팅 및 요구사항 정리', '요구사항 문서 v2', 90],
      [V.course, 'build', '[DEMO] 강의 6장 녹화', '강의 영상 3개 업로드', 150],
      [V.course, 'marketing', '[DEMO] 강의 상세페이지 개선', '', 60],
      [V.saas, 'build', '[DEMO] 예약 캘린더 기능 개발', '', 200],
      [V.saas, 'learning', '[DEMO] 결제 API 조사', '', 90],
      [V.youtube, 'marketing', '[DEMO] 영상 기획·촬영', '', 150],
      [null, 'admin', '[DEMO] 장부 정리·메일 처리', '', 60],
    ];
    for (let d = 44; d >= 0; d--) {
      const date = addDays(today, -d);
      const count = d % 7 === 0 ? 0 : 1 + Math.floor(rand() * 2.2);
      for (let k = 0; k < count; k++) {
        const [venture, category, task, output, base] = tasks[Math.floor(rand() * tasks.length)];
        add('worklogs', {
          date,
          venture_id: venture?.id ?? null,
          goal_id: monthOf(date) === thisMonth && venture === V.freelance ? g1.id : null,
          task,
          category,
          minutes: Math.max(15, Math.round((base * (0.6 + rand() * 0.8)) / 15) * 15),
          output: output && rand() > 0.25 ? `[DEMO] ${output}` : '',
        });
      }
    }

    repo.saveSettings({ demo_seeded: true });
    return { created: n };
  });
}
