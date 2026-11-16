import { act, renderHook, waitFor } from '@testing-library/react'
import { getOverview, getWatchlist, type OverviewResponse } from './api'
import { overview } from './testData'
import { useDashboardData } from './useDashboardData'

vi.mock('./api', () => ({ getOverview: vi.fn(), getWatchlist: vi.fn() }))

const watchlist = [{ symbol: 'AAPL', name: 'Apple' }]
const emptyOverview = (): OverviewResponse => ({
  range: '1D',
  symbol: { symbol: 'AAPL', price: null, changePct: null, points: [] },
  indices: overview().indices.map((i) => ({ ...i, level: null, changePct: null, low: null, high: null, points: [] })),
})

beforeEach(() => {
  vi.mocked(getWatchlist).mockReset().mockResolvedValue(watchlist)
  vi.mocked(getOverview)
    .mockReset()
    .mockImplementation(async (range, symbol) => overview({}, range, symbol ?? undefined))
})

describe('useDashboardData', () => {
  it('is loading until the requests settle, then ready (AC 2, 6)', async () => {
    const { result } = renderHook(() => useDashboardData('1D', null))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.failed).toEqual([])
    expect(getOverview).toHaveBeenCalledWith('1D', 'AAPL', expect.anything())
  })

  it('refetches everything on refresh (AC 1)', async () => {
    const { result } = renderHook(() => useDashboardData('1D', null))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.refresh())
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getWatchlist).toHaveBeenCalledTimes(2)
    expect(getOverview).toHaveBeenCalledTimes(2)
  })

  it('reports no-data when the overview is empty, whatever the watchlist holds (AC 3)', async () => {
    vi.mocked(getOverview).mockResolvedValue(emptyOverview())
    const { result } = renderHook(() => useDashboardData('1D', null))
    await waitFor(() => expect(result.current.status).toBe('no-data'))
  })

  it('leaves no-data once a refresh finds data (AC 4)', async () => {
    vi.mocked(getOverview).mockResolvedValueOnce(emptyOverview())
    const { result } = renderHook(() => useDashboardData('1D', null))
    await waitFor(() => expect(result.current.status).toBe('no-data'))
    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('reports partial when one section fails and reloads only that one (AC 5)', async () => {
    vi.mocked(getOverview).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useDashboardData('1D', null))
    await waitFor(() => expect(result.current.status).toBe('partial'))
    expect(result.current.failed).toEqual(['overview'])
    act(() => result.current.retry('overview'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getWatchlist).toHaveBeenCalledTimes(1)
    expect(getOverview).toHaveBeenCalledTimes(2)
  })

  it('reports error when every section fails, then recovers (AC 7, 9)', async () => {
    vi.mocked(getWatchlist).mockRejectedValueOnce(new Error('down'))
    vi.mocked(getOverview).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useDashboardData('1D', null))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.failed).toEqual(['watchlist', 'overview'])
    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('ignores a slow earlier round (AC 1, 4)', async () => {
    const resolvers: ((o: OverviewResponse) => void)[] = []
    vi.mocked(getOverview).mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))
    const { result } = renderHook(() => useDashboardData('1D', null))
    await waitFor(() => expect(resolvers).toHaveLength(1))
    act(() => result.current.refresh())
    await waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[1](overview({}, '1D', 'NEW'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => resolvers[0](emptyOverview()))
    expect(result.current.status).toBe('ready')
    expect(result.current.overview?.symbol?.symbol).toBe('NEW')
  })
})
