import type { ExpenseFilters, NewExpense } from '../stores/expenses.js';

export type ExpenseErrors = { amount?: string; date?: string; category?: string };

export type ExpenseValidation =
  | { ok: true; value: NewExpense }
  | { ok: false; errors: ExpenseErrors };

const MAX_AMOUNT = 9999999999.99;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

export type ListQuery = { filters: ExpenseFilters; page: number };

export type ListQueryValidation =
  | { ok: true; value: ListQuery }
  | { ok: false; errors: { dateRange?: string; category?: string } };

/** Ids are uuid columns: a malformed one must never reach Postgres, which would throw. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BAD_RANGE = 'The from date must be on or before the to date.';

/** Parses the GET /expenses query string. A bad page falls back to 1; a bad date range is rejected. */
export function parseListQuery(query: unknown): ListQueryValidation {
  const q = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>;
  const filters: ExpenseFilters = {};
  const search = text(q.q);
  if (search) filters.q = search;
  const categoryId = text(q.categoryId);
  if (categoryId) {
    if (!UUID.test(categoryId)) {
      return { ok: false, errors: { category: 'Choose a category from the list.' } };
    }
    filters.categoryId = categoryId;
  }

  for (const key of ['from', 'to'] as const) {
    const value = text(q[key]);
    if (!value) continue;
    if (!validDate(value)) return { ok: false, errors: { dateRange: BAD_RANGE } };
    filters[key] = value;
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return { ok: false, errors: { dateRange: BAD_RANGE } };
  }

  const n = Number(text(q.page));
  return { ok: true, value: { filters, page: Number.isInteger(n) && n >= 1 ? n : 1 } };
}

/** Validates an add-expense body. `today` is YYYY-MM-DD. Any other key (e.g. currency) is ignored. */
export function validateExpenseInput(body: unknown, today: string): ExpenseValidation {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: ExpenseErrors = {};
  const amount = text(b.amount);
  const date = text(b.date);
  const categoryId = text(b.categoryId);

  if (!amount) errors.amount = 'Enter an amount.';
  else if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0 || Number(amount) > MAX_AMOUNT) {
    errors.amount = 'Amount must be greater than zero.';
  } else if (/\.\d{3,}/.test(amount)) errors.amount = 'Amount can have at most two decimal places.';

  if (!date) errors.date = 'Enter a date.';
  else if (!validDate(date)) errors.date = 'Enter a valid date.';
  else if (date > today) errors.date = 'Date cannot be in the future.';

  if (!categoryId) errors.category = 'Choose a category.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { amount, date, categoryId, description: text(b.description) || null } };
}
