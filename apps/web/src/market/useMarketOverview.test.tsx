import { renderHook, waitFor } from '@testing-library/react'
import { getOverview, type OverviewResponse } from './api'
import { overview } from './testData'
import { useMarketOverview } from './useMarketOverview'

vi.mock('./api', () => ({ getOverview: vi.fn() }))

describe('useMarketOverview', () => {
  it('ignores a slow earlier response and aborts it', async () => {
    const resolvers: Record<string, (o: OverviewResponse) => void> = {}
    const signals: Record<string, AbortSignal> = {}
    vi.mocked(getOverview).mockImplementation(
      (range, _symbol, signal) =>
        new Promise((resolve) => {
          resolvers[range] = resolve
          signals[range] = signal!
        }),
    )
    const { result, rerender } = renderHook(({ range }) => useMarketOverview(range, 'AAPL'), {
      initialProps: { range: '1D' as const } as { range: '1D' | '1M' },
    })
    rerender({ range: '1M' })
    resolvers['1M'](overview({}, '1M'))
    resolvers['1D'](overview({}, '1D'))
    await waitFor(() => expect(result.current.data?.range).toBe('1M'))
    expect(signals['1D'].aborted).toBe(true)
    expect(result.current.data?.range).toBe('1M')
  })
})
