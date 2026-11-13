import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddExpenseForm from './AddExpenseForm'
import * as api from './api'
import { todayLocal } from './validation'

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getCategories: vi.fn(),
  createExpense: vi.fn(),
}))

const food = { id: 'cat-food', name: 'Food' }
const travel = { id: 'cat-travel', name: 'Travel' }
const userEvent = {
  type: async (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } }),
  clear: async (el: HTMLElement) => fireEvent.change(el, { target: { value: '' } }),
  selectOptions: async (el: HTMLElement, value: string) =>
    fireEvent.change(el, { target: { value } }),
  click: async (el: HTMLElement) => fireEvent.click(el),
}
const save = () => screen.getByRole('button', { name: 'Save expense' })

async function renderForm(categories = [food, travel]) {
  vi.mocked(api.getCategories).mockResolvedValue(categories)
  render(<AddExpenseForm />)
  await screen.findByLabelText('Category')
  await waitFor(() => expect(screen.queryByTestId('categories-loading')).not.toBeInTheDocument())
}

beforeEach(() => {
  vi.mocked(api.createExpense).mockReset().mockResolvedValue(undefined)
})

describe('AddExpenseForm', () => {
  it('offers only the user\'s categories (AC 7)', async () => {
    await renderForm()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose a category',
      'Food',
      'Travel',
    ])
  })

  it('shows no currency field (AC 9)', async () => {
    await renderForm()
    expect(screen.queryByLabelText(/currency/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/currency|\$|€|£/i)
  })

  it('shows the amount error on the field (AC 4)', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Amount'), '0')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-food')
    await userEvent.click(save())
    expect(screen.getByText('Amount must be greater than zero.')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true')
    expect(api.createExpense).not.toHaveBeenCalled()
  })

  it('shows the date error for a future date (AC 5)', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-food')
    const date = screen.getByLabelText('Date')
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await userEvent.clear(date)
    await userEvent.type(date, tomorrow)
    await userEvent.click(save())
    expect(screen.getByText('Date cannot be in the future.')).toBeInTheDocument()
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(api.createExpense).not.toHaveBeenCalled()
  })

  it('does not save with a missing field (AC 3)', async () => {
    await renderForm()
    await userEvent.click(save())
    expect(screen.getByText('Enter an amount.')).toBeInTheDocument()
    expect(screen.getByText('Choose a category.')).toBeInTheDocument()
    expect(api.createExpense).not.toHaveBeenCalled()
  })

  it('saves with today as the default date, then clears the form (AC 1, 2, 6, 10, 11)', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Amount'), '18.50')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-food')
    await userEvent.click(save())
    expect(api.createExpense).toHaveBeenCalledTimes(1)
    expect(api.createExpense).toHaveBeenCalledWith({
      amount: '18.50',
      date: todayLocal(),
      categoryId: 'cat-food',
      description: '',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Expense saved.')
    expect(screen.getByLabelText('Amount')).toHaveValue('')
    expect(screen.getByLabelText('Category')).toHaveValue('')
    expect(screen.getByLabelText(/Description/)).toHaveValue('')
    expect(screen.getByLabelText('Date')).toHaveValue(todayLocal())
  })

  it('shows a save failure and keeps the entry', async () => {
    vi.mocked(api.createExpense).mockRejectedValue(new Error('boom'))
    await renderForm()
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-food')
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save your expense. Try again.')
    expect(screen.getByLabelText('Amount')).toHaveValue('5')
  })

  it('directs a user with no categories to create one (AC 12, 13)', async () => {
    await renderForm([])
    expect(save()).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Create a category first')
    expect(screen.getByRole('button', { name: 'Create a category' })).toBeInTheDocument()
    expect(api.createExpense).not.toHaveBeenCalled()
  })
})
