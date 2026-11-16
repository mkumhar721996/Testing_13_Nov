import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpenseDetail from './ExpenseDetail'
import * as api from './api'

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getExpense: vi.fn(),
}))

const lunch: api.ExpenseItem = {
  id: 'id-1',
  amount: '54.60',
  date: '2026-11-15',
  categoryId: 'cat-food',
  categoryName: 'Food',
  description: 'Team lunch',
  createdAt: '2026-11-15T14:30:00.000Z',
}

beforeEach(() => {
  vi.mocked(api.getExpense).mockReset()
})

describe('ExpenseDetail', () => {
  it('shows amount, date, category and description (AC 7)', async () => {
    vi.mocked(api.getExpense).mockResolvedValue(lunch)
    render(<ExpenseDetail id="id-1" onBack={vi.fn()} />)
    expect(await screen.findByText('54.60')).toBeInTheDocument()
    expect(screen.getByText('15 Nov 2026')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Team lunch')).toBeInTheDocument()
    expect(api.getExpense).toHaveBeenCalledWith('id-1')
  })

  it('shows "No description" when there is none', async () => {
    vi.mocked(api.getExpense).mockResolvedValue({ ...lunch, description: null })
    render(<ExpenseDetail id="id-1" onBack={vi.fn()} />)
    expect(await screen.findByText('No description')).toBeInTheDocument()
  })

  it('shows not-found without any details (AC 11)', async () => {
    vi.mocked(api.getExpense).mockResolvedValue(null)
    render(<ExpenseDetail id="id-2" onBack={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Expense not found' })).toBeInTheDocument()
    expect(screen.queryByText('54.60')).not.toBeInTheDocument()
  })

  it('shows a load failure, not not-found, when the request fails', async () => {
    vi.mocked(api.getExpense).mockRejectedValue(new Error('boom'))
    render(<ExpenseDetail id="id-1" onBack={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByRole('heading', { name: 'Expense not found' })).not.toBeInTheDocument()
  })

  it('goes back to the list', async () => {
    vi.mocked(api.getExpense).mockResolvedValue(lunch)
    const onBack = vi.fn()
    render(<ExpenseDetail id="id-1" onBack={onBack} />)
    await screen.findByText('54.60')
    fireEvent.click(screen.getByRole('button', { name: 'Back to expenses' }))
    expect(onBack).toHaveBeenCalled()
  })
})
