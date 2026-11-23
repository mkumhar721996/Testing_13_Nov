import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getMovers, getOverview, getWatchlist } from './api'
import MarketOverview from './MarketOverview'
import { overview } from './testData'

vi.mock('./api', () => ({ getOverview: vi.fn(), getWatchlist: vi.fn(), getMovers: vi.fn() }))

const watchlist = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'Nvidia' },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getWatchlist).mockResolvedValue(watchlist)
  vi.mocked(getOverview).mockImplementation(async (range, symbol) => overview({}, range, symbol ?? undefined))
  vi.mocked(getMovers).mockResolvedValue({ gainers: [], losers: [] })
})

describe('MarketOverview movers', () => {
  it('shows the movers card once data is ready', async () => {
    render(<MarketOverview />)
    expect(await screen.findByRole('heading', { name: 'Top movers today' })).toBeInTheDocument()
  })

  it('hides the movers card when there is no market data or everything failed', async () => {
    const o = overview()
    vi.mocked(getOverview).mockResolvedValueOnce({
      ...o,
      symbol: null,
      indices: o.indices.map((i) => ({ ...i, level: null, points: [] })),
    })
    const { unmount } = render(<MarketOverview />)
    await screen.findByRole('heading', { name: 'No market data yet' })
    expect(screen.queryByRole('heading', { name: 'Top movers today' })).not.toBeInTheDocument()
    unmount()

    vi.mocked(getWatchlist).mockRejectedValueOnce(new Error('down'))
    vi.mocked(getOverview).mockRejectedValueOnce(new Error('down'))
    render(<MarketOverview />)
    await screen.findByRole('heading', { name: 'Quotes are unavailable right now' })
    expect(screen.queryByRole('heading', { name: 'Top movers today' })).not.toBeInTheDocument()
  })
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

describe('MarketOverview data states', () => {
  const emptyOverview = () => {
    const o = overview()
    return { ...o, symbol: null, indices: o.indices.map((i) => ({ ...i, level: null, points: [] })) }
  }
  const down = () => Promise.reject(new Error('down'))

  it('shows a loading indicator and disables Refresh while loading (AC 2)', () => {
    vi.mocked(getWatchlist).mockReturnValue(new Promise(() => {}))
    const { container } = render(<MarketOverview />)
    expect(screen.getByText(/Loading market data…/)).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()
  })

  it('refetches all data on Refresh (AC 1, 6)', async () => {
    render(<MarketOverview />)
    await screen.findByText('S&P 500', { selector: 'span' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    await screen.findByText('S&P 500', { selector: 'span' })
    expect(getWatchlist).toHaveBeenCalledTimes(2)
    expect(getOverview).toHaveBeenCalledTimes(2)
  })

  it('shows the no-market-data state and leaves it on Refresh (AC 3, 4)', async () => {
    vi.mocked(getOverview).mockResolvedValueOnce(emptyOverview())
    render(<MarketOverview />)
    await screen.findByRole('heading', { name: 'No market data yet' })
    expect(screen.queryByText('Some dashboard data could not be loaded')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /refresh/i })[0])
    await waitFor(() => expect(screen.queryByText('No market data yet')).not.toBeInTheDocument())
    expect(await screen.findByText('S&P 500', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows the partial-failure banner and reloads only the failed section (AC 5)', async () => {
    vi.mocked(getOverview).mockImplementationOnce(down)
    render(<MarketOverview />)
    expect(await screen.findByText('Some dashboard data could not be loaded')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload chart' }))
    expect(await screen.findByText('S&P 500', { selector: 'span' })).toBeInTheDocument()
    expect(getWatchlist).toHaveBeenCalledTimes(1)
    expect(getOverview).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Some dashboard data could not be loaded')).not.toBeInTheDocument()
  })

  it('shows the total-failure error and recovers on Try again (AC 7, 8, 9)', async () => {
    vi.mocked(getWatchlist).mockImplementationOnce(down)
    vi.mocked(getOverview).mockImplementationOnce(down)
    render(<MarketOverview />)
    expect(await screen.findByRole('heading', { name: 'Quotes are unavailable right now' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Market data could not be loaded')
    expect(screen.queryByText('Some dashboard data could not be loaded')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await screen.findByText('S&P 500', { selector: 'span' })
    expect(screen.queryByText('Quotes are unavailable right now')).not.toBeInTheDocument()
    expect(getWatchlist).toHaveBeenCalledTimes(2)
    expect(getOverview).toHaveBeenCalledTimes(2)
  })
})
