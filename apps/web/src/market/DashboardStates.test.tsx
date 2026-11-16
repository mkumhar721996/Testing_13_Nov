import { fireEvent, render, screen } from '@testing-library/react'
import { FailedSectionCard, NoMarketDataState, PartialFailureBanner, TotalFailureState } from './DashboardStates'

describe('DashboardStates', () => {
  it('names the failed sections in the banner and retries all (AC 5)', () => {
    const onRetryAll = vi.fn()
    render(<PartialFailureBanner failed={['watchlist']} onRetryAll={onRetryAll} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The watchlist is missing.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetryAll).toHaveBeenCalled()
  })

  it('reloads one failed section by id (AC 5)', () => {
    const onReload = vi.fn()
    render(<FailedSectionCard section="overview" onReload={onReload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload chart' }))
    expect(onReload).toHaveBeenCalledWith('overview')
  })

  it('offers Refresh in the empty state and Try again in the error state (AC 4, 8)', () => {
    const onRefresh = vi.fn()
    const onRetry = vi.fn()
    render(
      <>
        <NoMarketDataState onRefresh={onRefresh} />
        <TotalFailureState onRetry={onRetry} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRefresh).toHaveBeenCalled()
    expect(onRetry).toHaveBeenCalled()
  })
})
