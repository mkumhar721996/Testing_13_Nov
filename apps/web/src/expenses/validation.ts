export type ExpenseFormValues = {
  amount: string
  date: string
  categoryId: string
  description: string
}

export type ExpenseFormErrors = { amount?: string; date?: string; category?: string }

/** Today as YYYY-MM-DD in the browser's local time. */
export function todayLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Mirrors the API rules for fast feedback; the API stays the authority. */
export function validateExpenseForm(values: ExpenseFormValues, today: string): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {}
  const amount = values.amount.trim()

  if (!amount) errors.amount = 'Enter an amount.'
  else if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    errors.amount = 'Amount must be greater than zero.'
  } else if (/\.\d{3,}/.test(amount)) errors.amount = 'Amount can have at most two decimal places.'

  if (!values.date) errors.date = 'Enter a date.'
  else if (values.date > today) errors.date = 'Date cannot be in the future.'

  if (!values.categoryId) errors.category = 'Choose a category.'
  return errors
}
