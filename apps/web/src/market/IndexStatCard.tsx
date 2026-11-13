import type { OverviewResponse } from './api'
import { formatChange, formatLevel } from './format'

type Props = {
  index: OverviewResponse['indices'][number]
  /** e.g. "1 week" */
  rangeLabel: string
}

export default function IndexStatCard({ index, rangeLabel }: Props) {
  const decimals = index.key === 'vix' ? 1 : 2
  const change = formatChange(index.changePct)
  return (
    <article className="card stat">
      <span className="text-muted text-sm">{index.name}</span>
      <strong className="stat-value">{formatLevel(index.level, decimals)}</strong>
      <span className="stat-badges">
        <span className={`badge badge-${change.tone}`}>{change.text}</span>
        <span className="text-muted text-sm">over {rangeLabel}</span>
      </span>
      <div className="stat-range">
        <span>Low {formatLevel(index.low, decimals)}</span>
        <span>High {formatLevel(index.high, decimals)}</span>
      </div>
    </article>
  )
}
