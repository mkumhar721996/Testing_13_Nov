import { useEffect, useRef, useState } from 'react'
import {
  getCategories,
  listExpenses,
  type Category,
  type ExpenseListQuery,
  type ExpensePage,
} from './api'
import { formatDate } from './format'
import './expense-list.css'

type Props = {
  onOpen: (id: string) => void
  onAdd: () => void
  initialQuery?: ExpenseListQuery
  onQueryChange?: (query: ExpenseListQuery) => void
}

export const emptyQuery: ExpenseListQuery = { q: '', categoryId: '', from: '', to: '', page: 1 }
const RANGE_ERROR = 'The from date must be on or before the to date.'

export default function ExpenseList({ onOpen, onAdd, initialQuery, onQueryChange }: Props) {
  const [query, setQuery] = useState(initialQuery ?? emptyQuery)
  const [categories, setCategories] = useState<Category[]>([])
  const [result, setResult] = useState<ExpensePage | undefined>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(0)

  const badRange = Boolean(query.from && query.to && query.from > query.to)
  const filtered = Boolean(query.q || query.categoryId || query.from || query.to)
  const { from, to } = badRange ? { from: '', to: '' } : query

  useEffect(() => {
    getCategories().then(setCategories, () => setCategories([]))
  }, [])

  useEffect(() => {
    const request = ++latest.current
    setResult(undefined)
    setFailed(false)
    listExpenses({ q: query.q, categoryId: query.categoryId, from, to, page: query.page }).then(
      (found) => request === latest.current && setResult(found),
      () => request === latest.current && setFailed(true),
    )
  }, [query.q, query.categoryId, from, to, query.page, attempt])

  function update(next: ExpenseListQuery) {
    setQuery(next)
    onQueryChange?.(next)
  }
  const setFilter =
    (key: 'q' | 'categoryId' | 'from' | 'to') => (e: { target: { value: string } }) =>
      update({ ...query, [key]: e.target.value, page: 1 })
  const clear = () => update(emptyQuery)

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1
  const firstShown = result ? (result.page - 1) * result.pageSize + 1 : 0

  return (
    <div className="container list-wrap">
      <div className="stack">
        <div className="page-head">
          <div>
            <h1>Expenses</h1>
            <p className="page-lead">Your past expenses, newest first.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            Add expense
          </button>
        </div>

        <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="filter-q">Search description</label>
            <input
              className="input"
              id="filter-q"
              type="search"
              value={query.q}
              onChange={setFilter('q')}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-category">Category</label>
            <select
              className="select"
              id="filter-category"
              value={query.categoryId}
              onChange={setFilter('categoryId')}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-from">From date</label>
            <input
              className="input"
              id="filter-from"
              type="date"
              value={query.from}
              onChange={setFilter('from')}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-to">To date</label>
            <input
              className={`input${badRange ? ' is-invalid' : ''}`}
              id="filter-to"
              type="date"
              value={query.to}
              onChange={setFilter('to')}
              {...(badRange ? { 'aria-invalid': true, 'aria-describedby': 'filter-to-error' } : {})}
            />
            {badRange && (
              <span className="field-error" id="filter-to-error">
                {RANGE_ERROR}
              </span>
            )}
          </div>
          {filtered && (
            <button type="button" className="btn btn-ghost" onClick={clear}>
              Clear filters
            </button>
          )}
        </form>

        {failed ? (
          <div className="alert alert-danger" role="alert">
            <span>Your expenses could not be loaded. Check your connection and try again.</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : result === undefined ? (
          <div className="stack" role="status" aria-busy="true" aria-label="Loading expenses">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className="skeleton skel-row" />
            ))}
          </div>
        ) : result.items.length === 0 ? (
          filtered ? (
            <div className="empty-state">
              <h2>No expenses match</h2>
              <p>
                Nothing matches your search or filters. Change them or clear the filters to see all
                your expenses.
              </p>
              <button type="button" className="btn btn-secondary" onClick={clear}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <h2>No expenses yet</h2>
              <p>Add your first expense to start tracking where your money goes.</p>
              <button type="button" className="btn btn-primary" onClick={onAdd}>
                Add expense
              </button>
            </div>
          )
        ) : (
          <>
            <p className="result-meta">
              Showing {firstShown} to {firstShown + result.items.length - 1} of {result.total}{' '}
              expenses
            </p>
            <div className="table-wrap">
              <table className="table" aria-label="Your expenses, newest first">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((e) => (
                    <tr key={e.id}>
                      <td className="cell-date">{formatDate(e.date)}</td>
                      <td className="cell-desc">
                        <button
                          type="button"
                          className="btn btn-ghost row-link"
                          onClick={() => onOpen(e.id)}
                        >
                          {e.description ?? 'No description'}
                        </button>
                      </td>
                      <td className="cell-cat">
                        <span className="badge badge-pink">{e.categoryName}</span>
                      </td>
                      <td className="num cell-amt">{e.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav className="pager" aria-label="Expense pages">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={result.page <= 1}
                  onClick={() => update({ ...query, page: query.page - 1 })}
                >
                  Previous
                </button>
                <span>
                  Page {result.page} of {pages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={result.page >= pages}
                  onClick={() => update({ ...query, page: query.page + 1 })}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}
