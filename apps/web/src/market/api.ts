export type RangeKey = '1D' | '1W' | '1M' | '1Y'
export type IndexKey = 'spx' | 'ndx' | 'dji' | 'vix'

export type Point = { at: string; value: number }
export type WatchlistItem = { symbol: string; name: string }

export type OverviewResponse = {
  range: RangeKey
  symbol: { symbol: string; price: number | null; changePct: number | null; points: Point[] } | null
  indices: {
    key: IndexKey
    name: string
    level: number | null
    changePct: number | null
    low: number | null
    high: number | null
    points: Point[]
  }[]
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch('/watchlist')
  if (!res.ok) throw new Error('Could not load watchlist')
  return (await res.json()).symbols
}

export async function getOverview(
  range: RangeKey,
  symbol: string | null,
  signal?: AbortSignal,
): Promise<OverviewResponse> {
  const params = new URLSearchParams({ range })
  if (symbol) params.set('symbol', symbol)
  const res = await fetch(`/market/overview?${params}`, { signal })
  if (!res.ok) throw new Error('Could not load market overview')
  return res.json()
}
