import { useEffect, useState, type FormEvent } from 'react'
import { createExpense, ExpenseRejectedError, getCategories, type Category } from './api'
import { todayLocal, validateExpenseForm, type ExpenseFormErrors } from './validation'
import './expense-form.css'

type Status = 'idle' | 'saving' | 'saved' | 'failed'

const emptyValues = () => ({ amount: '', date: todayLocal(), categoryId: '', description: '' })

export default function AddExpenseForm() {
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState<ExpenseFormErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [categories, setCategories] = useState<Category[] | undefined>()
  const [categoriesFailed, setCategoriesFailed] = useState(false)

  useEffect(() => {
    getCategories().then(setCategories, () => setCategoriesFailed(true))
  }, [])

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  const noCategories = categories?.length === 0
  const hasErrors = Object.keys(errors).length > 0

  function reset() {
    setValues(emptyValues())
    setErrors({})
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateExpenseForm(values, todayLocal())
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setStatus('idle')
      return
    }
    setStatus('saving')
    try {
      await createExpense(values)
      reset()
      setStatus('saved')
    } catch (err) {
      if (err instanceof ExpenseRejectedError) {
        setErrors(err.errors)
        setStatus('idle')
      } else {
        setStatus('failed')
      }
    }
  }

  const invalid = (field: keyof ExpenseFormErrors) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {}
  const message = (field: keyof ExpenseFormErrors) =>
    errors[field] && (
      <span className="field-error" id={`${field}-error`}>
        {errors[field]}
      </span>
    )

  return (
    <div className="container form-wrap">
      <div className="stack">
        <h1>Add expense</h1>
        <p className="page-lead">Enter the amount, date and category. The description is optional.</p>
        <form className="stack" noValidate onSubmit={onSubmit}>
          {noCategories && (
            <div className="alert alert-warning" role="alert">
              <p>You have no categories yet. Create a category first, then record your expense.</p>
            </div>
          )}
          {hasErrors && (
            <div className="alert alert-danger" role="alert">
              <span>Nothing was saved. Fix the fields below and save again.</span>
            </div>
          )}
          {(status === 'failed' || categoriesFailed) && (
            <div className="alert alert-danger" role="alert">
              <span>We could not save your expense. Try again.</span>
            </div>
          )}
          {status === 'saved' && (
            <div className="alert alert-success" role="status">
              <span>Expense saved. The form is clear for your next one.</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              className={`input${errors.amount ? ' is-invalid' : ''}`}
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              value={values.amount}
              onChange={set('amount')}
              {...invalid('amount')}
            />
            {message('amount')}
          </div>

          <div className="field">
            <label htmlFor="date">Date</label>
            <input
              className={`input${errors.date ? ' is-invalid' : ''}`}
              id="date"
              name="date"
              type="date"
              max={todayLocal()}
              value={values.date}
              onChange={set('date')}
              {...invalid('date')}
            />
            {errors.date ? message('date') : <span className="field-hint">Today or an earlier day.</span>}
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            {categories === undefined && !categoriesFailed ? (
              <span className="skeleton" data-testid="categories-loading" />
            ) : null}
            <select
              className={`select${errors.category ? ' is-invalid' : ''}`}
              id="category"
              name="category"
              value={values.categoryId}
              onChange={set('categoryId')}
              disabled={noCategories || categories === undefined}
              hidden={categories === undefined}
              {...(noCategories
                ? { 'aria-describedby': 'category-hint' }
                : invalid('category'))}
            >
              {noCategories ? (
                <option value="">No categories</option>
              ) : (
                <>
                  <option value="">Choose a category</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            {noCategories && (
              <span className="field-hint" id="category-hint">
                Expenses need a category. Add one to continue.
              </span>
            )}
            {message('category')}
          </div>

          <div className="field">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              className="textarea"
              id="description"
              name="description"
              rows={3}
              placeholder="e.g. Lunch with client"
              value={values.description}
              onChange={set('description')}
            />
          </div>

          <div className="form-actions">
            {noCategories ? (
              <button type="button" className="btn btn-secondary">
                Create a category
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={noCategories || categories === undefined || status === 'saving'}
            >
              Save expense
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
