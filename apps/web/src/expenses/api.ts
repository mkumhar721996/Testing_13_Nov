import type { ExpenseFormErrors } from './validation'

export type Category = { id: string; name: string }

export type ExpensePayload = {
  amount: string
  date: string
  categoryId: string
  description: string
}

/** The API rejected the expense; `errors` are per-field messages. */
export class ExpenseRejectedError extends Error {
  constructor(readonly errors: ExpenseFormErrors) {
    super('Expense rejected')
  }
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch('/categories')
  if (!res.ok) throw new Error('Could not load categories')
  return (await res.json()).categories
}

export async function createExpense(payload: ExpensePayload): Promise<void> {
  const res = await fetch('/expenses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) throw new ExpenseRejectedError((await res.json()).errors ?? {})
  if (!res.ok) throw new Error('Could not save expense')
}
