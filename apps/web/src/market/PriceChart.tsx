import { useId } from 'react'
import type { IndexKey, OverviewResponse, WatchlistItem } from './api'
import ChartLegend from './ChartLegend'
import { buildChartModel, PLOT, yFor } from './chart-model'
import { formatLevel, formatSignedPct } from './format'

type Props = {
  data: OverviewResponse
  rangeLabel: string
  watchlist: WatchlistItem[]
  visible: Record<IndexKey, boolean>
  onSymbolChange: (symbol: string) => void
  onToggle: (id: IndexKey) => void
}

export default function PriceChart({ data, rangeLabel, watchlist, visible, onSymbolChange, onToggle }: Props) {
  const titleId = useId()
  const symbolId = useId()
  const model = buildChartModel(data, visible)
  const symbol = data.symbol
  const shown = data.indices.filter((i) => visible[i.key]).map((i) => i.name)
  const leftDigits = model.leftAxis.step < 1 || model.leftAxis.step % 1 ? 1 : 0
  const rightDigits = model.rightAxis && model.rightAxis.step % 1 ? 1 : 0

  return (
    <section className="card stack chart" aria-labelledby={titleId}>
      <div className="chart-head">
        <div>
          <h3 id={titleId}>{symbol ? `${symbol.symbol} price, ${rangeLabel}` : `Price, ${rangeLabel}`}</h3>
          {symbol && symbol.price !== null && symbol.changePct !== null && (
            <p className="text-muted text-sm m-0">
              Last {formatLevel(symbol.price, 2)}, {formatSignedPct(symbol.changePct, 1)} over {rangeLabel}
            </p>
          )}
        </div>
        <div className="symbol-field">
          <label htmlFor={symbolId}>Symbol</label>
          <select
            id={symbolId}
            className="select"
            value={symbol?.symbol ?? ''}
            disabled={watchlist.length === 0}
            onChange={(e) => onSymbolChange(e.target.value)}
          >
            {watchlist.map((w) => (
              <option key={w.symbol} value={w.symbol}>
                {w.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ChartLegend visible={visible} onToggle={onToggle} />

      <p className="text-muted text-sm m-0">
        Left axis: change since the start of the range.{' '}
        {model.rightAxis
          ? 'Right axis: VIX level, on its own scale.'
          : 'VIX is hidden.'}
      </p>
      <div className="plot">
        <svg
          viewBox="0 0 640 252"
          role="img"
          aria-label={`Line chart of ${symbol?.symbol ?? 'no symbol'} over ${rangeLabel} ${
            shown.length ? `with ${shown.join(', ')} lines` : 'with no index lines'
          }`}
        >
          <g>
            {model.leftAxis.ticks.map((t) => {
              const y = yFor(model.leftAxis, t)
              return (
                <g key={`l${t}`}>
                  <line className={t === 0 ? 'gl zero' : 'gl'} x1={PLOT.x0} x2={PLOT.x1} y1={y} y2={y} />
                  <text className="ax" x={PLOT.x0 - 4} y={y + 4} textAnchor="end">
                    {t === 0 ? '0%' : formatSignedPct(t, leftDigits)}
                  </text>
                </g>
              )
            })}
            {model.rightAxis?.ticks.map((t) => (
              <text key={`r${t}`} className="ax" x={PLOT.x1 + 4} y={yFor(model.rightAxis!, t) + 4}>
                {t.toFixed(rightDigits)}
              </text>
            ))}
            {model.xLabels.map((l) => (
              <text key={l.x} className="ax" x={l.x} y="242" textAnchor={l.anchor}>
                {l.text}
              </text>
            ))}
          </g>
          <g>
            {model.lines.map((l) => (
              <polyline key={l.key} className={`ln ln-${l.key}`} points={l.points} />
            ))}
            {model.segments.map((s, i) => (
              <polyline key={i} className={`ln ln-sym ${s.direction}`} points={s.points} />
            ))}
          </g>
        </svg>
      </div>
    </section>
  )
}
