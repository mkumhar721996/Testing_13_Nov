import { useEffect, useState } from 'react'
import { getExpense, type ExpenseItem } from './api'
import { formatDate, formatRecorded } from './format'
import './expense-list.css'

type Props = { id: string; onBack: () => void }

export default function ExpenseDetail({ id, onBack }: Props) {
  // undefined = loading, null = not found
  const [expense, setExpense] = useState<ExpenseItem | null | undefined>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    setExpense(undefined)
    setFailed(false)
    getExpense(id).then(
      (found) => current && setExpense(found),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [id, attempt])

  return (
    <div className="container list-wrap">
      <div className="stack">
        <div>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back to expenses
          </button>
        </div>
        <h1>Expense details</h1>
        {failed ? (
          <div className="alert alert-danger" role="alert">
            <span>This expense could not be loaded. Check your connection and try again.</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : expense === undefined ? (
          <div className="stack" role="status" aria-busy="true" aria-label="Loading expense">
            <span className="skeleton skel-row" />
            <span className="skeleton skel-row" />
          </div>
        ) : expense === null ? (
          <div className="empty-state" role="alert">
            <h2>Expense not found</h2>
            <p>It may have been removed, or it is not on your account. Go back to your list to find it.</p>
            <button type="button" className="btn btn-primary" onClick={onBack}>
              Back to expenses
            </button>
          </div>
        ) : (
          <div className="card detail-card">
            <p className="detail-amount">{expense.amount}</p>
            <dl className="detail">
              <dt>Date</dt>
              <dd>{formatDate(expense.date)}</dd>
              <dt>Category</dt>
              <dd>
                <span className="badge badge-pink">{expense.categoryName}</span>
              </dd>
              <dt>Description</dt>
              <dd>{expense.description ?? 'No description'}</dd>
              <dt>Recorded</dt>
              <dd>{formatRecorded(expense.createdAt)}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
