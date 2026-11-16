import { useEffect, useId, useState } from 'react'
import type { IndexKey, RangeKey } from './api'
import {
  FailedSectionCard,
  Icon,
  LoadingState,
  NoMarketDataState,
  PartialFailureBanner,
  TotalFailureState,
} from './DashboardStates'
import IndexStatCard from './IndexStatCard'
import PriceChart from './PriceChart'
import { useDashboardData } from './useDashboardData'
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
  const rangeId = useId()
  const [range, setRange] = useState<RangeKey>('1D')
  const [symbol, setSymbol] = useState<string | null>(null)
  const [visible, setVisible] = useState(ALL_VISIBLE)
  const [announcement, setAnnouncement] = useState('')
  const { status, failed, watchlist, overview: data, refresh, retry } = useDashboardData(range, symbol)

  useEffect(() => {
    if (status === 'loading') setAnnouncement('Loading market data')
    else setAnnouncement((a) => (a === 'Loading market data' ? 'Market data updated' : a))
  }, [status])

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

  const sections = data && (
    <>
      <div className="grid">
        {data.indices.map((index) => (
          <IndexStatCard key={index.key} index={index} rangeLabel={labelFor(data.range)} />
        ))}
      </div>
      <PriceChart
        data={data}
        rangeLabel={labelFor(data.range)}
        watchlist={watchlist ?? []}
        visible={visible}
        onSymbolChange={changeSymbol}
        onToggle={toggle}
      />
    </>
  )

  return (
    <div className="overview">
      <div className="page-header">
        <h1>Market overview</h1>
        <div className="header-actions">
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
          <button type="button" className="btn btn-primary" disabled={status === 'loading'} onClick={refresh}>
            <Icon id="loader" /> Refresh
          </button>
        </div>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {status === 'loading' && <LoadingState />}
      {status === 'no-data' && <NoMarketDataState onRefresh={refresh} />}
      {status === 'error' && <TotalFailureState onRetry={refresh} />}
      {status === 'ready' && sections}
      {status === 'partial' && (
        <>
          <PartialFailureBanner failed={failed} onRetryAll={refresh} />
          {sections}
          {failed.map((section) => (
            <FailedSectionCard key={section} section={section} onReload={retry} />
          ))}
        </>
      )}
    </div>
  )
}
