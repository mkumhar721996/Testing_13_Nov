import { useEffect, useId, useState } from 'react'
import { getWatchlist, type IndexKey, type RangeKey, type WatchlistItem } from './api'
import IndexStatCard from './IndexStatCard'
import PriceChart from './PriceChart'
import { useMarketOverview } from './useMarketOverview'
import './market.css'

const RANGES: { id: RangeKey; label: string }[] = [
  { id: '1D', label: '1 day' },
  { id: '1W', label: '1 week' },
  { id: '1M', label: '1 month' },
  { id: '1Y', label: '1 year' },
]

const ALL_VISIBLE: Record<IndexKey, boolean> = { spx: true, ndx: true, dji: true, vix: true }

const INDEX_NAMES: Record<IndexKey, string> = { spx: 'S&P 500', ndx: 'Nasdaq', dji: 'Dow', vix: 'VIX' }

export default function MarketOverview() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | undefined>()

  useEffect(() => {
    // A failed watchlist load leaves the chart without a symbol; error states are a separate story.
    getWatchlist().then(setWatchlist, () => setWatchlist([]))
  }, [])

  return watchlist ? <Overview watchlist={watchlist} /> : null
}

function Overview({ watchlist }: { watchlist: WatchlistItem[] }) {
  const rangeId = useId()
  const [range, setRange] = useState<RangeKey>('1D')
  const [symbol, setSymbol] = useState<string | null>(watchlist[0]?.symbol ?? null)
  const [visible, setVisible] = useState(ALL_VISIBLE)
  const [announcement, setAnnouncement] = useState('')
  const { data } = useMarketOverview(range, symbol)

  const labelFor = (id: RangeKey) => RANGES.find((r) => r.id === id)!.label

  const changeRange = (next: RangeKey) => {
    setRange(next)
    setAnnouncement(`Showing ${labelFor(next)}. Index stats and chart updated.`)
  }
  const changeSymbol = (next: string) => {
    setSymbol(next)
    setAnnouncement(`Chart shows ${next}.`)
  }
  const toggle = (id: IndexKey) => {
    setVisible((v) => ({ ...v, [id]: !v[id] }))
    setAnnouncement(`${INDEX_NAMES[id]} ${visible[id] ? 'hidden' : 'shown'} on the chart.`)
  }

  return (
    <div className="overview">
      <div className="page-header">
        <h1>Market overview</h1>
        <div className="range-field">
          <label htmlFor={rangeId}>Range</label>
          <select
            id={rangeId}
            className="select"
            value={range}
            onChange={(e) => changeRange(e.target.value as RangeKey)}
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {data && (
        <>
          <div className="grid">
            {data.indices.map((index) => (
              <IndexStatCard key={index.key} index={index} rangeLabel={labelFor(data.range)} />
            ))}
          </div>
          <PriceChart
            data={data}
            rangeLabel={labelFor(data.range)}
            watchlist={watchlist}
            visible={visible}
            onSymbolChange={changeSymbol}
            onToggle={toggle}
          />
        </>
      )}
    </div>
  )
}
