import type { IndexKey, OverviewResponse, RangeKey } from './api'

type Series = Partial<Record<IndexKey | 'symbol', number[]>>

const names: Record<IndexKey, string> = { spx: 'S&P 500', ndx: 'Nasdaq', dji: 'Dow', vix: 'VIX' }

const toPoints = (values: number[]) =>
  values.map((value, i) => ({ at: new Date(Date.UTC(2026, 10, 13, 9, 30 + i)).toISOString(), value }))

/** Builds an overview. Index and symbol series are percent change; VIX is a level. */
export function overview(series: Series = {}, range: RangeKey = '1D', symbol = 'AAPL'): OverviewResponse {
  const level = (pct: number[]) => pct.map((p) => 100 * (1 + p / 100))
  const stats = (values: number[]) => ({
    level: values.at(-1) ?? null,
    changePct: values.length ? ((values.at(-1)! - values[0]) / values[0]) * 100 : null,
    low: values.length ? Math.min(...values) : null,
    high: values.length ? Math.max(...values) : null,
    points: toPoints(values),
  })
  const defaults: Record<IndexKey, number[]> = {
    spx: [0, 0.4, 0.84],
    ndx: [0, 0.6, 1.12],
    dji: [0, 0.1, -0.21],
    vix: [14.5, 15.3, 14.6],
  }
  const indices = (Object.keys(names) as IndexKey[]).map((key) => {
    const raw = series[key] ?? defaults[key]
    return { key, name: names[key], ...stats(key === 'vix' ? raw : level(raw)) }
  })
  const sym = level(series.symbol ?? [0, 1, 0.5])
  const s = stats(sym)
  return { range, symbol: { symbol, price: s.level, changePct: s.changePct, points: s.points }, indices }
}
