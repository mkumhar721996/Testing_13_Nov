import type { NewExpense } from '../stores/expenses.js';

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
