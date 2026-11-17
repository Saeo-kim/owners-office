import { openDatabase } from '../server/sqlite.js';
import { createRepository } from '../src/core/repository.js';
import { createApi } from '../src/core/api.js';

export const NOW = new Date(2026, 10, 17); // 2026-11-17, local time

export function setup(now = NOW) {
  const db = openDatabase(':memory:');
  const repo = createRepository(db);
  const api = createApi({ repo, now: () => now });
  const call = (method, path, body) => api.handle({ method, path: `/api${path.split('?')[0]}`, query: Object.fromEntries(new URLSearchParams(path.split('?')[1] ?? '')), body });
  return { db, repo, api, call };
}

// Minimal snapshot for pure analytics tests.
export const emptyData = () => ({ accounts: [], employees: [], ventures: [], transactions: [], goals: [], plans: [], worklogs: [] });

let nextId = 1;
export const tx = (o) => ({ id: nextId++, is_demo: 0, venture_id: null, employee_id: null, income_type: null, scope: null, cost_nature: null, cost_class: null, description: '', ...o });
export const income = (date, amount, income_type = 'business_revenue', extra = {}) => tx({ date, amount, direction: 'income', income_type, ...extra });
export const expense = (date, amount, extra = {}) => tx({ date, amount, direction: 'expense', scope: 'business', cost_nature: 'variable', cost_class: 'operating', ...extra });
export const employee = (o) => ({ id: nextId++, is_demo: 0, name: 'E', department: 'operations', kind: 'software', role: '', duties: '', monthly_cost: 10000, purchase_price: null, useful_life_months: null, usage_frequency: 'daily', contribution: null, satisfaction: null, monthly_value: null, value_basis: '', overlap_group: '', status: 'keep', ...o });
export const venture = (o) => ({ id: nextId++, is_demo: 0, name: 'V', summary: '', stage: 'revenue', status: 'active', expected_monthly_revenue: null, forecast_basis: '', forecast_confidence: null, ...o });
export const goal = (o) => ({ id: nextId++, is_demo: 0, title: 'G', period_type: 'monthly', period: '2026-11', metric: 'business_revenue', target_value: 100, unit: '', manual_actual: null, venture_id: null, ...o });
export const log = (o) => ({ id: nextId++, is_demo: 0, venture_id: null, goal_id: null, task: 't', category: 'build', minutes: 60, output: '', ...o });
