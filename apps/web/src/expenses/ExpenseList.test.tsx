import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpenseList from './ExpenseList'
import * as api from './api'
import type { ExpenseItem, ExpensePage } from './api'

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getCategories: vi.fn(),
  listExpenses: vi.fn(),
}))

const noFilters = { q: '', categoryId: '', from: '', to: '', page: 1 }
const item = (n: number, over: Partial<ExpenseItem> = {}): ExpenseItem => ({
  id: `id-${n}`,
  amount: '10.00',
  date: '2026-11-15',
  categoryId: 'cat-food',
  categoryName: 'Food',
  description: `Expense ${n}`,
  createdAt: '2026-11-15T10:00:00.000Z',
  ...over,
})
const page = (items: ExpenseItem[], total = items.length, p = 1): ExpensePage => ({
  items,
  page: p,
  pageSize: 20,
  total,
})
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const lastCall = () => vi.mocked(api.listExpenses).mock.lastCall?.[0]

function renderList(onOpen = vi.fn(), onAdd = vi.fn()) {
  render(<ExpenseList onOpen={onOpen} onAdd={onAdd} />)
  return { onOpen, onAdd }
}

beforeEach(() => {
  vi.mocked(api.getCategories).mockReset().mockResolvedValue([
    { id: 'cat-food', name: 'Food' },
    { id: 'cat-travel', name: 'Travel' },
  ])
  vi.mocked(api.listExpenses).mockReset().mockResolvedValue(page([item(1)]))
})

describe('ExpenseList', () => {
  it('renders the returned expenses in the returned order (AC 1, 2, 12)', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue(
      page([
        item(1, { date: '2026-11-30' }),
        item(2, { date: '2026-11-15' }),
        item(3, { date: '2026-11-01' }),
      ]),
    )
    renderList()
    expect(await screen.findByRole('table', { name: 'Your expenses, newest first' })).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('30 Nov 2026')).toBeInTheDocument()
    expect(within(rows[2]).getByText('15 Nov 2026')).toBeInTheDocument()
    expect(within(rows[3]).getByText('1 Nov 2026')).toBeInTheDocument()
    expect(api.listExpenses).toHaveBeenCalledWith(noFilters)
  })

  it('shows a pager for more than 20 expenses (AC 3)', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => item(i))
    vi.mocked(api.listExpenses).mockResolvedValue(page(twenty, 25))
    renderList()
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('Showing 1 to 20 of 25 expenses')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(lastCall()).toEqual({ ...noFilters, page: 2 })
  })

  it('shows no pager for one page', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue(page([item(1)], 5))
    renderList()
    await screen.findByRole('table')
    expect(screen.queryByRole('navigation', { name: 'Expense pages' })).not.toBeInTheDocument()
  })

  it('sends search, category and date filters and returns to page 1 (AC 4, 5, 6, 10)', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue(page([item(1)], 45))
    renderList()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(lastCall()?.page).toBe(2)

    type('Search description', 'LUNCH')
    expect(lastCall()).toEqual({ ...noFilters, q: 'LUNCH' })
    await screen.findByText('Page 1 of 3')
    fireEvent.change(await screen.findByLabelText('Category'), { target: { value: 'cat-food' } })
    type('From date', '2026-11-10')
    type('To date', '2026-11-20')
    expect(lastCall()).toEqual({
      q: 'LUNCH',
      categoryId: 'cat-food',
      from: '2026-11-10',
      to: '2026-11-20',
      page: 1,
    })
  })

  it('offers the user\'s categories', async () => {
    renderList()
    await screen.findByRole('table')
    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent),
    ).toEqual(['All categories', 'Food', 'Travel'])
  })

  it('flags a from date after the to date and does not send the dates', async () => {
    renderList()
    await screen.findByRole('table')
    type('From date', '2026-11-20')
    type('To date', '2026-11-10')
    expect(screen.getByText('The from date must be on or before the to date.')).toBeInTheDocument()
    expect(screen.getByLabelText('To date')).toHaveAttribute('aria-invalid', 'true')
    expect(lastCall()).toEqual(noFilters)
  })

  it('ignores a stale response', async () => {
    let resolveOld!: (p: ExpensePage) => void
    vi.mocked(api.listExpenses)
      .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(page([item(2, { description: 'Newer result' })]))
    renderList()
    type('Search description', 'x')
    expect(await screen.findByText('Newer result')).toBeInTheDocument()
    await act(async () => {
      resolveOld(page([item(1, { description: 'Older result' })]))
    })
    expect(screen.queryByText('Older result')).not.toBeInTheDocument()
    expect(screen.getByText('Newer result')).toBeInTheDocument()
  })

  it('tells a user with no expenses how to add one (AC 8)', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue(page([]))
    const { onAdd } = renderList()
    expect(await screen.findByRole('heading', { name: 'No expenses yet' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Add expense' })
    fireEvent.click(buttons[buttons.length - 1])
    expect(onAdd).toHaveBeenCalled()
  })

  it('says nothing matches when filters hide every expense (AC 9)', async () => {
    renderList()
    await screen.findByRole('table')
    vi.mocked(api.listExpenses).mockResolvedValue(page([]))
    type('Search description', 'zzz')
    expect(await screen.findByRole('heading', { name: 'No expenses match' })).toBeInTheDocument()
    expect(screen.getByText(/Change them or clear the filters/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No expenses yet' })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(lastCall()).toEqual(noFilters)
  })

  it('opens the detail of a row (AC 7)', async () => {
    const { onOpen } = renderList()
    fireEvent.click(await screen.findByRole('button', { name: 'Expense 1' }))
    expect(onOpen).toHaveBeenCalledWith('id-1')
  })

  it('shows the right range on the last, partial page', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue(
      page([item(21), item(22), item(23), item(24), item(25)], 25, 2),
    )
    renderList()
    expect(await screen.findByText('Showing 21 to 25 of 25 expenses')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled()
  })

  it('labels an expense without a description', async () => {
    vi.mocked(api.listExpenses).mockResolvedValue(page([item(1, { description: null })]))
    renderList()
    expect(await screen.findByRole('button', { name: 'No description' })).toBeInTheDocument()
  })

  it('shows the clear-filters button only while a filter is active', async () => {
    renderList()
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
    type('Search description', 'x')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('allows a single-day range where from equals to', async () => {
    renderList()
    await screen.findByRole('table')
    type('From date', '2026-11-15')
    type('To date', '2026-11-15')
    expect(screen.queryByText('The from date must be on or before the to date.')).not.toBeInTheDocument()
    expect(lastCall()).toEqual({ ...noFilters, from: '2026-11-15', to: '2026-11-15' })
  })

  it('does not show a zero-result message while the first load fails', async () => {
    vi.mocked(api.listExpenses).mockRejectedValue(new Error('boom'))
    renderList()
    await screen.findByRole('alert')
    expect(screen.queryByRole('heading', { name: 'No expenses yet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No expenses match' })).not.toBeInTheDocument()
  })

  it('shows a loading state, then an error with retry', async () => {
    vi.mocked(api.listExpenses).mockRejectedValueOnce(new Error('boom'))
    renderList()
    const loading = screen.getByRole('status', { name: 'Loading expenses' })
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByRole('alert')).toHaveTextContent('Your expenses could not be loaded.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(api.listExpenses).toHaveBeenCalledTimes(2)
  })
})
