import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./expenses/api', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-food', name: 'Food' }]),
  createExpense: vi.fn(),
  listExpenses: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'id-1',
        amount: '54.60',
        date: '2026-11-15',
        categoryId: 'cat-food',
        categoryName: 'Food',
        description: 'Team lunch',
        createdAt: '2026-11-15T14:30:00.000Z',
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  }),
  getExpense: vi.fn().mockResolvedValue(null),
  ExpenseRejectedError: class extends Error {},
}))

describe('App', () => {
  it('starts on the expense list', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    await screen.findByRole('table')
  })

  it('opens a detail and returns to the list with the filters kept', async () => {
    render(<App />)
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Search description'), { target: { value: 'lunch' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Team lunch' }))
    expect(await screen.findByRole('heading', { name: 'Expense details' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to expenses' })[0])
    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search description')).toHaveValue('lunch')
  })

  it('opens the add-expense form from the list', async () => {
    render(<App />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(await screen.findByRole('heading', { name: 'Add expense' })).toBeInTheDocument()
  })
})
