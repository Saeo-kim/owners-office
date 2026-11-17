// Field definitions for every editable record. The repository validates
// against them and the browser builds its forms from them.
import * as E from './enums.js';

const text = (label, opts = {}) => ({ type: 'text', label, max: 200, default: '', ...opts });
const area = (label, opts = {}) => ({ type: 'textarea', label, max: 4000, default: '', ...opts });
const money = (label, opts = {}) => ({ type: 'int', money: true, label, min: 0, max: 1e13, ...opts });
const choice = (label, values, opts = {}) => ({ type: 'enum', label, values, ...opts });
const date = (label, opts = {}) => ({ type: 'date', label, ...opts });
const ref = (label, resource, opts = {}) => ({ type: 'ref', label, resource, ...opts });
const score = (label, opts = {}) => ({ type: 'int', label, min: 1, max: 5, score: true, ...opts });

const isIncome = (r) => r.direction === 'income';
const isExpense = (r) => r.direction === 'expense';

export const RESOURCES = {
  accounts: {
    table: 'accounts',
    label: '계좌·자산',
    order: 'liquid DESC, balance DESC',
    fields: {
      name: text('계좌·자산 이름', { required: true, max: 80 }),
      kind: choice('종류', E.ACCOUNT_KINDS, { required: true, default: 'bank' }),
      balance: { type: 'int', money: true, label: '잔액 (원)', required: true, min: -1e13, max: 1e13, help: '부채는 음수로 입력' },
      liquid: { type: 'bool', label: '즉시 사용 가능한 자금', default: true },
      as_of: date('잔액 기준일', { required: true, defaultToday: true }),
      note: area('메모', { max: 1000 }),
    },
  },

  employees: {
    table: 'employees',
    label: '직원 (제품·서비스)',
    order: "CASE status WHEN 'terminated' THEN 1 ELSE 0 END, department, monthly_cost DESC",
    fields: {
      name: text('직원명 (제품·서비스명)', { required: true, max: 80 }),
      department: choice('소속 부서', E.DEPARTMENTS, { required: true, default: 'operations' }),
      kind: choice('유형', E.EMPLOYEE_KINDS, { required: true, default: 'software' }),
      role: text('직무', { max: 120 }),
      duties: area('담당 업무·주요 역할', { max: 2000 }),
      monthly_cost: money('월 유지비 = 급여 (원)', { required: true, default: 0 }),
      purchase_price: money('구입가 (원, 기기만)', { help: '내용연수로 나눠 월 감가비로 더합니다' }),
      useful_life_months: { type: 'int', label: '내용연수 (개월)', min: 1, max: 240 },
      usage_frequency: choice('사용 빈도', E.USAGE, { required: true, default: 'weekly' }),
      contribution: score('업무 기여도 (1–5)', { help: '실제 업무 산출물에 얼마나 기여하는가' }),
      satisfaction: score('주관적 만족도 (1–5)', { help: '경제적 효용과 별도로 평가' }),
      monthly_value: money('월 경제적 효용 추정 (원)', { help: '절약 시간×시간가치, 대체 비용 등. 모르면 비워 두세요' }),
      value_basis: area('효용 산정 근거', { max: 1000 }),
      overlap_group: text('중복 업무 그룹', { max: 60, help: '같은 일을 하는 직원끼리 같은 이름을 넣으세요 (예: AI 어시스턴트)' }),
      status: choice('검토 상태', E.EMPLOYEE_STATUS, { required: true, default: 'keep' }),
      started_on: date('고용일 (사용 시작)'),
      note: area('메모', { max: 1000 }),
    },
    check(r, errors) {
      if (r.purchase_price && !r.useful_life_months) errors.useful_life_months = '구입가를 입력하면 내용연수도 필요합니다.';
    },
  },

  ventures: {
    table: 'ventures',
    label: '사업·프로젝트',
    order: "CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, id",
    fields: {
      name: text('프로젝트명', { required: true, max: 80 }),
      summary: area('개요', { max: 2000 }),
      stage: choice('수익화 단계', E.VENTURE_STAGES, { required: true, default: 'idea' }),
      status: choice('진행 상태', E.VENTURE_STATUS, { required: true, default: 'active' }),
      started_on: date('시작일', { defaultToday: true }),
      expected_monthly_revenue: money('예상 월 매출 (원)', { help: '예상치입니다. 실제 매출에는 절대 합산되지 않습니다' }),
      forecast_basis: area('예상 매출 근거', { max: 2000, help: '계약, 대기 고객 수, 전환율 등 검증 가능한 근거' }),
      forecast_confidence: choice('예상 신뢰도', E.CONFIDENCE),
      note: area('메모', { max: 2000 }),
    },
    check(r, errors) {
      if (r.expected_monthly_revenue > 0 && !r.forecast_confidence) {
        errors.forecast_confidence = '예상 매출을 입력하면 신뢰도도 선택해야 합니다.';
      }
    },
  },

  transactions: {
    table: 'transactions',
    label: '수입·지출',
    order: 'date DESC, id DESC',
    fields: {
      date: date('날짜', { required: true, defaultToday: true }),
      direction: choice('구분', E.DIRECTIONS, { required: true, default: 'expense' }),
      amount: money('금액 (원)', { required: true, min: 1 }),
      income_type: choice('수입 유형', E.INCOME_TYPES, { showIf: isIncome }),
      scope: choice('비용 범위', E.EXPENSE_SCOPES, { showIf: isExpense }),
      cost_nature: choice('고정/변동', E.COST_NATURES, { showIf: isExpense }),
      cost_class: choice('비용 분류', E.COST_CLASSES, { showIf: isExpense }),
      venture_id: ref('관련 사업', 'ventures'),
      employee_id: ref('관련 직원 (유지비 지급)', 'employees', { showIf: isExpense }),
      description: text('내용', { max: 200 }),
    },
    check(r, errors) {
      if (r.direction === 'income') {
        if (!r.income_type) errors.income_type = '수입 유형을 선택하세요.';
        r.scope = r.cost_nature = r.cost_class = r.employee_id = null;
      } else {
        if (!r.scope) errors.scope = '비용 범위를 선택하세요.';
        if (!r.cost_nature) errors.cost_nature = '고정비/변동비를 선택하세요.';
        if (!r.cost_class) errors.cost_class = '비용 분류를 선택하세요.';
        r.income_type = null;
      }
    },
  },

  goals: {
    table: 'goals',
    label: '목표',
    order: 'period DESC, id',
    fields: {
      title: text('목표', { required: true, max: 120 }),
      period_type: choice('기간 유형', E.PERIOD_TYPES, { required: true, default: 'monthly' }),
      period: text('기간', { required: true, max: 7, help: '월간: 2026-11, 연간: 2026', defaultPeriod: true }),
      metric: choice('측정 지표', E.GOAL_METRICS, { required: true, default: 'business_revenue' }),
      target_value: { type: 'int', label: '목표값', required: true, min: 0, max: 1e13 },
      unit: text('단위 (직접 입력 지표)', { max: 20, showIf: (r) => r.metric === 'custom' }),
      manual_actual: { type: 'int', label: '실제값 (직접 입력 지표)', min: 0, max: 1e13, showIf: (r) => r.metric === 'custom' },
      venture_id: ref('대상 사업 (비우면 전체)', 'ventures'),
      note: area('메모', { max: 2000 }),
    },
    check(r, errors) {
      const ok = r.period_type === 'monthly' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(r.period) : /^\d{4}$/.test(r.period);
      if (!ok) errors.period = r.period_type === 'monthly' ? 'YYYY-MM 형식으로 입력하세요.' : 'YYYY 형식으로 입력하세요.';
      if (r.metric !== 'custom') r.manual_actual = null;
    },
  },

  plans: {
    table: 'plans',
    label: '실행 계획',
    order: "CASE status WHEN 'done' THEN 2 WHEN 'dropped' THEN 3 ELSE 0 END, due_date IS NULL, due_date",
    fields: {
      goal_id: ref('목표', 'goals', { required: true }),
      title: text('실행 항목', { required: true, max: 160 }),
      due_date: date('마감일'),
      status: choice('상태', E.PLAN_STATUS, { required: true, default: 'todo' }),
      planned_minutes: { type: 'int', label: '계획 시간 (분)', min: 0, max: 100000 },
      note: area('메모', { max: 1000 }),
    },
  },

  worklogs: {
    table: 'work_logs',
    label: '업무 기록',
    order: 'date DESC, id DESC',
    fields: {
      date: date('날짜', { required: true, defaultToday: true }),
      task: text('업무', { required: true, max: 160 }),
      category: choice('업무 유형', E.WORK_CATEGORIES, { required: true, default: 'build' }),
      minutes: { type: 'int', label: '실제 작업 시간 (분)', required: true, min: 1, max: 1440 },
      venture_id: ref('관련 사업', 'ventures'),
      goal_id: ref('관련 목표', 'goals'),
      output: area('결과물', { max: 2000, help: '배포, 문서, 계약, 게시물 등 확인 가능한 결과. 없으면 비워 두세요' }),
      note: area('메모', { max: 1000 }),
    },
  },
};

// Added for the Cash Desk. Receivables are promises, not cash: when money
// arrives, record it as a transaction and mark the receivable paid.
RESOURCES.receivables = {
  table: 'receivables',
  label: '받을 돈 (계약·청구)',
  order: "CASE status WHEN 'invoiced' THEN 0 WHEN 'contract' THEN 1 WHEN 'paid' THEN 2 ELSE 3 END, due_date, id",
  fields: {
    client: text('거래처 (고객)', { required: true, max: 80 }),
    title: text('내용', { required: true, max: 120, help: '예: 랜딩 페이지 제작 잔금' }),
    amount: money('금액 (원)', { required: true, min: 1 }),
    status: choice('상태', E.RECEIVABLE_STATUS, { required: true, default: 'contract' }),
    venture_id: ref('관련 사업', 'ventures'),
    contract_date: date('계약일'),
    due_date: date('입금 예정일'),
    paid_on: date('입금일', { help: '입금되면 Finance에 수입(사업 매출)으로도 기록하세요' }),
    note: area('메모', { max: 1000 }),
  },
  check(r, errors) {
    if (r.status === 'paid' && !r.paid_on) errors.paid_on = '입금 완료라면 입금일을 입력하세요.';
  },
};

RESOURCES.obligations = {
  table: 'obligations',
  label: '나갈 돈 (세금·납부 의무)',
  order: "CASE status WHEN 'upcoming' THEN 0 ELSE 1 END, due_date, id",
  fields: {
    kind: choice('종류', E.OBLIGATION_KINDS, { required: true, default: 'income_tax' }),
    title: text('내용', { required: true, max: 120, help: '예: 2026년 귀속 종합소득세' }),
    amount: money('금액 (원, 모르면 추정치)', { required: true, min: 1 }),
    estimated: { type: 'bool', label: '금액이 추정치임', default: true },
    due_date: date('납부 기한', { required: true }),
    status: choice('상태', E.OBLIGATION_STATUS, { required: true, default: 'upcoming' }),
    paid_on: date('납부일'),
    note: area('메모', { max: 1000 }),
  },
};

export const RESOURCE_NAMES = Object.keys(RESOURCES);
export const isResource = (name) => Object.hasOwn(RESOURCES, name);
