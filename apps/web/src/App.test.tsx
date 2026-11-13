import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./expenses/api', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  createExpense: vi.fn(),
  ExpenseRejectedError: class extends Error {},
}))

describe('App', () => {
  it('renders the add-expense form', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Add expense' })).toBeInTheDocument()
    await screen.findByRole('alert')
  })
})
