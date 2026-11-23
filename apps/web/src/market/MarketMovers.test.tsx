import { fireEvent, render, screen, within } from '@testing-library/react'
import { getMovers } from './api'
import MarketMovers from './MarketMovers'

vi.mock('./api', () => ({ getMovers: vi.fn() }))

const data = {
  gainers: [
    { symbol: 'SMCI', name: 'Super Micro', price: 41.2, changePct: 6.8 },
    { symbol: 'PLTR', name: 'Palantir', price: 24.1, changePct: 4.1 },
    { symbol: 'AMD', name: 'AMD', price: 150, changePct: 2.5 },
  ],
  losers: [
    { symbol: 'INTC', name: 'Intel', price: 30, changePct: -4.2 },
    { symbol: 'WBA', name: 'Walgreens', price: 12, changePct: -3.6 },
    { symbol: 'PFE', name: 'Pfizer', price: 27, changePct: -2.2 },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getMovers).mockResolvedValue(data)
})

describe('MarketMovers', () => {
  it('lists the top gainers and losers (AC 1, 2)', async () => {
    render(<MarketMovers />)
    const gainers = await screen.findByRole('table', { name: 'Top gainers' })
    const losers = screen.getByRole('table', { name: 'Top losers' })
    expect(within(gainers).getAllByRole('row')).toHaveLength(4)
    expect(within(gainers).getByRole('rowheader', { name: 'SMCI' })).toBeInTheDocument()
    expect(within(gainers).getByText('▲ +6.8%')).toBeInTheDocument()
    expect(within(gainers).getByText('41.20')).toBeInTheDocument()
    expect(within(losers).getByText('▼ −4.2%')).toBeInTheDocument()
  })

  it('does nothing when an entry is clicked (AC 3)', async () => {
    const { container } = render(<MarketMovers />)
    const row = (await screen.findByRole('rowheader', { name: 'SMCI' })).closest('tr')!
    const before = container.innerHTML
    const hash = window.location.hash
    fireEvent.click(row)
    expect(container.innerHTML).toBe(before)
    expect(window.location.hash).toBe(hash)
    expect(getMovers).toHaveBeenCalledTimes(1)
  })

  it('shows entries as plain rows, not links or buttons (AC 4)', async () => {
    render(<MarketMovers />)
    const section = (await screen.findByRole('heading', { name: 'Top movers today' })).closest('section')!
    expect(within(section).queryByRole('link')).toBeNull()
    expect(within(section).queryByRole('button')).toBeNull()
    const rows = section.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(6)
    rows.forEach((tr) => {
      expect(tr.querySelector('a, button, [tabindex], [role]')).toBeNull()
      expect(tr).not.toHaveAttribute('onclick')
      expect(tr).not.toHaveAttribute('role')
      expect(tr).not.toHaveAttribute('tabindex')
    })
  })

  it('shows a loading state', () => {
    vi.mocked(getMovers).mockReturnValue(new Promise(() => {}))
    render(<MarketMovers />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading market data…')
  })

  it('shows the empty state and refetches on Check again', async () => {
    vi.mocked(getMovers).mockResolvedValueOnce({ gainers: [], losers: [] })
    render(<MarketMovers />)
    expect(await screen.findByText('No movers yet today')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(getMovers).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('table', { name: 'Top gainers' })).toBeInTheDocument()
  })

  it('shows an error and recovers on Try again', async () => {
    vi.mocked(getMovers).mockRejectedValueOnce(new Error('down'))
    render(<MarketMovers />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(getMovers).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('table', { name: 'Top gainers' })).toBeInTheDocument()
  })

  it('replaces an empty list with a note', async () => {
    vi.mocked(getMovers).mockResolvedValue({ ...data, losers: [] })
    render(<MarketMovers />)
    expect(await screen.findByText('No losers yet today')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Top gainers' })).toBeInTheDocument()
  })
})
