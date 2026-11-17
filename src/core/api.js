// Transport-independent API. The Node server and the in-browser backend
// both call handle({ method, path, query, body }) and get { status, body }.
import { RESOURCES, isResource } from './resources.js';
import { NotFoundError, ValidationError } from './repository.js';
import { addMonths, isoDate, monthOf, yearOf } from './dates.js';
import {
  assets,
  cashflow,
  employeesAnalysis,
  goalsAnalysis,
  isExpense,
  isRevenue,
  monthTotals,
  productivity,
  runway,
  sum,
  ventureAnalysis,
} from './analytics.js';
import { runAudit } from './audit.js';
import { seedDemo } from './seed.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function createApi({ repo, now = () => new Date(), mode = 'server' }) {
  const today = () => isoDate(now());
  const pickMonth = (q) => {
    if (q.month === undefined || q.month === '') return monthOf(today());
    if (!MONTH_RE.test(q.month)) throw new ValidationError({ month: 'month는 YYYY-MM 형식이어야 합니다.' });
    return q.month;
  };
  const snapshot = () => {
    const settings = repo.getSettings();
    return { settings, data: repo.loadData({ includeDemo: settings.include_demo }), today: today() };
  };
  const demoNote = (data) => {
    const demoRows = Object.values(data).reduce((n, rows) => n + rows.filter((r) => r.is_demo).length, 0);
    return { demoRows, includesDemo: demoRows > 0 };
  };

  const analysis = {
    dashboard(q) {
      const { settings, data, today: t } = snapshot();
      const month = pickMonth(q);
      const inMonth = (x) => monthOf(x.date) === month;
      const findings = runAudit(data, settings, t);
      return {
        today: t,
        month,
        ...demoNote(data),
        assets: assets(data),
        current: monthTotals(data, month),
        previous: monthTotals(data, addMonths(month, -1)),
        cashflow: cashflow(data, month, 12),
        upkeep: employeesAnalysis(data).totals,
        runway: runway(data, t),
        ventures: ventureAnalysis(data, t, settings)
          .filter((v) => v.status === 'active')
          .map((v) => {
            const txs = data.transactions.filter((x) => x.venture_id === v.id && inMonth(x));
            return {
              id: v.id, name: v.name, stage: v.stage, is_demo: v.is_demo,
              monthRevenue: sum(txs.filter(isRevenue), (x) => x.amount),
              monthCost: sum(txs.filter(isExpense), (x) => x.amount),
              totalRevenue: v.actual.revenue,
              hours: v.actual.hours,
              expectedMonthly: v.expected.monthlyRevenue,
            };
          }),
        goals: goalsAnalysis(data, t).filter((g) => g.period === month || g.period === yearOf(month)),
        alerts: findings.filter((f) => f.severity === 'high' || f.severity === 'medium').slice(0, 6),
        auditCount: findings.length,
      };
    },
    finance(q) {
      const { data, today: t } = snapshot();
      const month = pickMonth(q);
      const ventures = data.ventures.map((v) => {
        const all = data.transactions.filter((x) => x.venture_id === v.id);
        const m = all.filter((x) => monthOf(x.date) === month);
        const pl = (rows) => {
          const revenue = sum(rows.filter(isRevenue), (x) => x.amount);
          const cost = sum(rows.filter(isExpense), (x) => x.amount);
          return { revenue, cost, profit: revenue - cost };
        };
        return { id: v.id, name: v.name, status: v.status, is_demo: v.is_demo, month: pl(m), total: pl(all), expectedMonthly: v.expected_monthly_revenue };
      });
      const unassigned = data.transactions.filter((x) => !x.venture_id && monthOf(x.date) === month && (isRevenue(x) || (isExpense(x) && x.scope === 'business')));
      return {
        today: t,
        month,
        ...demoNote(data),
        current: monthTotals(data, month),
        cashflow: cashflow(data, month, 12),
        ventures,
        unassigned: {
          revenue: sum(unassigned.filter(isRevenue), (x) => x.amount),
          cost: sum(unassigned.filter(isExpense), (x) => x.amount),
        },
        goals: goalsAnalysis(data, t).filter((g) => ['business_revenue', 'net_profit', 'expense_cap'].includes(g.metric)),
        assets: assets(data),
        runway: runway(data, t),
      };
    },
    employees() {
      const { data } = snapshot();
      return { ...demoNote(data), ...employeesAnalysis(data) };
    },
    ventures() {
      const { settings, data, today: t } = snapshot();
      return { today: t, ...demoNote(data), hourlyValue: settings.hourly_value, ventures: ventureAnalysis(data, t, settings), maxActive: settings.max_active_ventures };
    },
    goals() {
      const { data, today: t } = snapshot();
      return { today: t, ...demoNote(data), goals: goalsAnalysis(data, t), plans: data.plans };
    },
    productivity(q) {
      const { data, today: t } = snapshot();
      const days = q.days === undefined ? 30 : Number(q.days);
      if (!Number.isInteger(days) || days < 7 || days > 366) throw new ValidationError({ days: 'days는 7–366 사이 정수입니다.' });
      return { today: t, ...demoNote(data), ...productivity(data, t, days) };
    },
    audit() {
      const { settings, data, today: t } = snapshot();
      return { today: t, ...demoNote(data), findings: runAudit(data, settings, t) };
    },
  };

  function route(method, parts, query, body) {
    const [head, id, extra] = parts;
    if (extra !== undefined) throw new NotFoundError('경로를 찾을 수 없습니다.');
    if (head === 'health' && method === 'GET') return { ok: true, mode };
    if (head === 'status' && method === 'GET') return { mode, today: today(), settings: repo.getSettings(), counts: repo.counts() };
    if (head === 'settings') {
      if (method === 'GET') return repo.getSettings();
      if (method === 'PUT') return repo.saveSettings(body);
    }
    if (head === 'analysis' && method === 'GET' && Object.hasOwn(analysis, id)) return analysis[id](query);
    if (head === 'demo' && id === undefined) {
      if (method === 'POST') return seedDemo(repo, now());
      if (method === 'DELETE') return repo.deleteDemo();
    }
    if (head === 'export' && method === 'GET') return repo.exportAll();
    if (head === 'import' && method === 'POST') return repo.importAll(body);
    if (head === 'bank-import' && method === 'POST' && id === undefined) return repo.importBankStatement(body ?? {});
    if (isResource(head)) {
      if (id === undefined) {
        if (method === 'GET') return repo.list(head, { includeDemo: query.demo === 'all' ? true : repo.getSettings().include_demo });
        if (method === 'POST') return [201, repo.create(head, body)];
      } else {
        if (!/^\d+$/.test(id)) throw new NotFoundError();
        if (method === 'GET') return repo.get(head, id);
        if (method === 'PUT') return repo.update(head, id, body);
        if (method === 'DELETE') return repo.remove(head, id);
      }
      return [405, { error: '허용되지 않는 메서드입니다.' }];
    }
    throw new NotFoundError('경로를 찾을 수 없습니다.');
  }

  function handle({ method = 'GET', path, query = {}, body = null }) {
    const parts = path.replace(/^\/?api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    try {
      const result = route(method.toUpperCase(), parts, query, body);
      return Array.isArray(result) && typeof result[0] === 'number' && result.length === 2
        ? { status: result[0], body: result[1] }
        : { status: 200, body: result };
    } catch (err) {
      if (err instanceof ValidationError) return { status: 400, body: { error: err.message, errors: err.errors } };
      if (err instanceof NotFoundError) return { status: 404, body: { error: err.message } };
      console.error(err);
      return { status: 500, body: { error: '서버 오류가 발생했습니다.' } };
    }
  }

  return { handle, resources: Object.keys(RESOURCES) };
}
