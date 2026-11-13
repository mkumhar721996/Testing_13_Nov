import { useEffect, useState } from 'react'
import { getOverview, type OverviewResponse, type RangeKey } from './api'

/** The overview for the current range and symbol; a reply for an earlier selection is dropped. */
export function useMarketOverview(range: RangeKey, symbol: string | null): { data: OverviewResponse | null } {
  const [data, setData] = useState<OverviewResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let latest = true
    getOverview(range, symbol, controller.signal).then(
      (next) => {
        if (latest) setData(next)
      },
      () => {
        // Failure states belong to their own story; keep showing the last overview.
      },
    )
    return () => {
      latest = false
      controller.abort()
    }
  }, [range, symbol])

  return { data }
}
