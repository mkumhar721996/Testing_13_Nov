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

export type ExpenseItem = {
  id: string
  amount: string
  date: string
  categoryId: string
  categoryName: string
  description: string | null
  createdAt: string
}

export type ExpenseListQuery = {
  q: string
  categoryId: string
  from: string
  to: string
  page: number
}

export type ExpensePage = { items: ExpenseItem[]; page: number; pageSize: number; total: number }

/** Lists the user's expenses, newest first. Only non-empty filters are sent. */
export async function listExpenses(query: ExpenseListQuery): Promise<ExpensePage> {
  const params = new URLSearchParams()
  for (const key of ['q', 'categoryId', 'from', 'to'] as const) {
    if (query[key]) params.set(key, query[key])
  }
  params.set('page', String(query.page))
  const res = await fetch(`/expenses?${params}`)
  if (!res.ok) throw new Error('Could not load expenses')
  return res.json()
}

/** Resolves null when the expense does not exist or is not the user's. */
export async function getExpense(id: string): Promise<ExpenseItem | null> {
  const res = await fetch(`/expenses/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Could not load expense')
  return res.json()
}
