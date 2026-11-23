import { useCallback, useEffect, useRef, useState } from 'react'
import { getOverview, getWatchlist, type OverviewResponse, type RangeKey, type WatchlistItem } from './api'

export type Section = 'watchlist' | 'overview'
export type DashboardStatus = 'loading' | 'ready' | 'no-data' | 'partial' | 'error'

type Result<T> = { ok: true; data: T } | { ok: false }
type State = {
  loading: boolean
  symbol: string | null
  watchlist: Result<WatchlistItem[]> | null
  overview: Result<OverviewResponse> | null
}

const SECTIONS: Section[] = ['watchlist', 'overview']

const settle = <T,>(request: Promise<T>): Promise<Result<T>> =>
  request.then(
    (data) => ({ ok: true, data }),
    () => ({ ok: false }),
  )

const isEmpty = (o: OverviewResponse) =>
  o.indices.every((i) => i.points.length === 0) && (o.symbol?.points.length ?? 0) === 0

/**
 * The dashboard's data: the watchlist and the market overview, loaded as independent sections.
 * Everything reloads on mount, on `refresh()` and when the range or chosen symbol changes; a reply
 * from an earlier round is dropped. The watchlist does not count towards "no data" (the Watchlist
 * epic owns its empty state).
 */
export function useDashboardData(range: RangeKey, selected: string | null) {
  const [round, setRound] = useState(0)
  const [state, setState] = useState<State>({ loading: true, symbol: null, watchlist: null, overview: null })
  const current = useRef(state)
  current.current = state
  const epoch = useRef(0)

  useEffect(() => {
    let live = true
    const controller = new AbortController()
    const id = ++epoch.current
    setState((s) => ({ ...s, loading: true }))
    void (async () => {
      const watchlist = await settle(getWatchlist())
      const symbol = selected ?? (watchlist.ok ? (watchlist.data[0]?.symbol ?? null) : null)
      const overview = await settle(getOverview(range, symbol, controller.signal))
      if (live && id === epoch.current) setState({ loading: false, symbol, watchlist, overview })
    })()
    return () => {
      live = false
      controller.abort()
    }
  }, [range, selected, round])

  const refresh = useCallback(() => setRound((r) => r + 1), [])

  const retry = useCallback(
    (section: Section) => {
      const id = epoch.current
      const request =
        section === 'watchlist'
          ? settle(getWatchlist())
          : settle(getOverview(range, current.current.symbol))
      void request.then((result) => {
        if (id === epoch.current) setState((s) => ({ ...s, [section]: result }))
      })
    },
    [range],
  )

  const failed = SECTIONS.filter((s) => state[s] && !state[s]!.ok)
  const overviewData = state.overview?.ok ? state.overview.data : undefined
  let status: DashboardStatus = 'ready'
  if (state.loading) status = 'loading'
  else if (failed.length === SECTIONS.length) status = 'error'
  else if (failed.length > 0) status = 'partial'
  else if (overviewData && isEmpty(overviewData)) status = 'no-data'

  return {
    status,
    failed,
    watchlist: state.watchlist?.ok ? state.watchlist.data : undefined,
    overview: overviewData,
    refresh,
    retry,
  }
}
