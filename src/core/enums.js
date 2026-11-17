// Shared vocabulary. Imported by the server, the browser UI, and tests,
// so a label changed here changes everywhere.

const pairs = (obj) => Object.freeze(obj);

export const DEPARTMENTS = pairs({
  ceo: 'CEO / 대표자',
  finance: 'Finance / 재무팀',
  bizdev: 'Business Development / 사업개발팀',
  hr: 'HR & Resources / 인사·자원팀',
  strategy: 'Strategy & Planning / 경영기획팀',
  operations: 'Operations / 운영관리팀',
  audit: 'Audit & Review / 감사·검증팀',
});

export const EMPLOYEE_KINDS = pairs({
  device: '기기 (스마트폰·노트북·태블릿)',
  telecom: '통신 (모바일·인터넷)',
  ai: 'AI 구독 서비스',
  devtool: '개발 도구',
  cloud: '클라우드·서버',
  software: '유료 소프트웨어',
  other: '기타',
});

export const USAGE = pairs({
  daily: '매일',
  weekly: '주 1회 이상',
  monthly: '월 1회 이상',
  rarely: '거의 사용 안 함',
  never: '사용 안 함',
});

export const EMPLOYEE_STATUS = pairs({
  keep: '유지',
  improve: '개선 필요',
  review: '해지 검토',
  terminated: '해지 완료',
});

export const ACCOUNT_KINDS = pairs({
  cash: '현금',
  bank: '은행 예금',
  savings: '적금·비상금',
  investment: '투자 자산',
  debt: '부채 (음수 잔액)',
  other: '기타',
});

export const DIRECTIONS = pairs({ income: '수입', expense: '지출' });

// Business revenue is the only income that counts as 매출.
export const INCOME_TYPES = pairs({
  business_revenue: '사업 매출',
  grant: '지원금 (정부·기관)',
  living_support: '생활비 지원',
  personal_other: '기타 개인 수입',
});

export const EXPENSE_SCOPES = pairs({ business: '사업 비용', personal: '개인 비용' });
export const COST_NATURES = pairs({ fixed: '고정비', variable: '변동비' });

// Labor (실제 인건비) and product/service upkeep are kept apart on purpose.
export const COST_CLASSES = pairs({
  labor: '인건비 (사람)',
  product_service: '제품·서비스 유지비',
  operating: '운영비',
  marketing: '마케팅',
  tax: '세금·공과금',
  living: '생활비',
  other: '기타',
});

export const VENTURE_STAGES = pairs({
  idea: '아이디어',
  validation: '검증',
  building: '개발·준비',
  launched: '출시',
  revenue: '매출 발생',
  scaling: '확장',
});

export const VENTURE_STATUS = pairs({ active: '진행 중', paused: '보류', closed: '종료' });
export const CONFIDENCE = pairs({ low: '낮음', medium: '보통', high: '높음' });

export const PERIOD_TYPES = pairs({ monthly: '월간', yearly: '연간' });

export const GOAL_METRICS = pairs({
  business_revenue: '사업 매출 (원)',
  net_profit: '사업 순이익 (원)',
  expense_cap: '총지출 상한 (원)',
  work_hours: '작업 시간 (시간)',
  outputs: '결과물 수 (건)',
  custom: '직접 입력 지표',
});

export const PLAN_STATUS = pairs({ todo: '예정', doing: '진행 중', done: '완료', dropped: '중단' });

export const WORK_CATEGORIES = pairs({
  build: '개발·제작',
  sales: '영업·고객',
  marketing: '마케팅·콘텐츠',
  admin: '행정·관리',
  learning: '학습·리서치',
  other: '기타',
});

// The four kinds of number the app shows. They are never added together.
export const VALUE_KINDS = pairs({
  target: '목표',
  plan: '계획',
  expected: '예상',
  actual: '실제',
});

// Money that is promised but not yet in the bank. Never added to 매출.
export const RECEIVABLE_STATUS = pairs({
  contract: '계약 확정 (미청구)',
  invoiced: '청구함 (미입금)',
  paid: '입금 완료',
  cancelled: '취소',
});

// Money I must pay: taxes and other fixed obligations.
export const OBLIGATION_KINDS = pairs({
  vat: '부가가치세',
  income_tax: '종합소득세',
  local_tax: '지방소득세',
  insurance: '국민연금·건강보험',
  card: '카드 대금',
  loan: '대출 상환',
  other: '기타 납부',
});
export const OBLIGATION_STATUS = pairs({ upcoming: '납부 예정', paid: '납부 완료' });

// Where a number came from. Only bank_csv is "verified".
export const DATA_SOURCES = pairs({
  bank_csv: '은행 내역 파일 (검증)',
  manual: '직접 입력',
});

export const SEVERITY =pairs({ high: '높음', medium: '보통', low: '낮음', info: '참고' });
