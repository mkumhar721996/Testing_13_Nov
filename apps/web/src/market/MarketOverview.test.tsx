import { fireEvent, render, screen } from '@testing-library/react'
import { getOverview, getWatchlist } from './api'
import MarketOverview from './MarketOverview'
import { overview } from './testData'

vi.mock('./api', () => ({ getOverview: vi.fn(), getWatchlist: vi.fn() }))

const watchlist = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'Nvidia' },
]

beforeEach(() => {
  vi.mocked(getWatchlist).mockResolvedValue(watchlist)
  vi.mocked(getOverview).mockImplementation(async (range, symbol) => overview({}, range, symbol ?? undefined))
})

describe('MarketOverview', () => {
  it('opens on 1D and makes the picked range active (AC 10, 1)', async () => {
    render(<MarketOverview />)
    const range = await screen.findByRole('combobox', { name: 'Range' })
    expect(range).toHaveValue('1D')
    fireEvent.change(range, { target: { value: '1M' } })
    expect(range).toHaveValue('1M')
  })

  it('refreshes stats and chart for the new range (AC 2, 3)', async () => {
    render(<MarketOverview />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'Range' }), { target: { value: '1W' } })
    expect(await screen.findAllByText(/^over 1 week$/)).toHaveLength(4)
    expect(getOverview).toHaveBeenLastCalledWith('1W', 'AAPL', expect.anything())
    expect(screen.getByRole('heading', { name: 'AAPL price, 1 week' })).toBeInTheDocument()
  })

  it('shows range, four stats and chart together (AC 4, 5)', async () => {
    render(<MarketOverview />)
    for (const n of ['S&P 500', 'Nasdaq', 'Dow', 'VIX']) {
      expect(await screen.findByText(n, { selector: 'span' })).toBeVisible()
    }
    expect(screen.getByRole('combobox', { name: 'Range' })).toBeVisible()
    expect(screen.getByRole('img', { name: /Line chart of AAPL/ })).toBeVisible()
  })

  it('opens on the first watchlist symbol and follows the selector (AC 6, 11)', async () => {
    render(<MarketOverview />)
    const symbol = await screen.findByRole('combobox', { name: 'Symbol' })
    expect(symbol).toHaveValue('AAPL')
    fireEvent.change(symbol, { target: { value: 'NVDA' } })
    expect(await screen.findByRole('heading', { name: /^NVDA price/ })).toBeInTheDocument()
    expect(getOverview).toHaveBeenLastCalledWith('1D', 'NVDA', expect.anything())
  })

  it('shows all four lines and toggles one (AC 8, 9, 12, 13)', async () => {
    const { container } = render(<MarketOverview />)
    await screen.findByRole('img', { name: /Line chart of AAPL/ })
    expect(container.querySelectorAll('polyline.ln-spx, polyline.ln-ndx, polyline.ln-dji, polyline.ln-vix')).toHaveLength(4)
    expect(screen.getByText(/Right axis: VIX level/)).toBeInTheDocument()
    const nasdaq = screen.getByRole('button', { name: 'Nasdaq' })
    expect(nasdaq).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(nasdaq)
    expect(nasdaq).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('polyline.ln-ndx')).toBeNull()
    fireEvent.click(nasdaq)
    expect(container.querySelector('polyline.ln-ndx')).not.toBeNull()
  })

  it('disables the symbol select for an empty watchlist', async () => {
    vi.mocked(getWatchlist).mockResolvedValue([])
    render(<MarketOverview />)
    expect(await screen.findByRole('combobox', { name: 'Symbol' })).toBeDisabled()
    expect(getOverview).toHaveBeenLastCalledWith('1D', null, expect.anything())
  })
})
