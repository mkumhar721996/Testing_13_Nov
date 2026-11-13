import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./expenses/api', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  createExpense: vi.fn(),
  ExpenseRejectedError: class extends Error {},
}))

vi.mock('./organization/api', () => ({
  getOrganization: vi.fn().mockReturnValue(new Promise(() => {})),
  saveOrganization: vi.fn(),
  OrganizationRejectedError: class extends Error {},
}))

afterEach(() => window.history.pushState({}, '', '/'))

describe('App', () => {
  it('renders the add-expense form', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Add expense' })).toBeInTheDocument()
    await screen.findByRole('alert')
  })

  it('renders the Organization screen at /organizations/:id', () => {
    window.history.pushState({}, '', '/organizations/11111111-1111-4111-8111-111111111111')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Organization' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Add expense' })).not.toBeInTheDocument()
  })
})
