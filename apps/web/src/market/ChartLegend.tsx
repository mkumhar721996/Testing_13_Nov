import type { IndexKey } from './api'

const ENTRIES: { id: IndexKey; label: string }[] = [
  { id: 'spx', label: 'S&P 500' },
  { id: 'ndx', label: 'Nasdaq' },
  { id: 'dji', label: 'Dow' },
  { id: 'vix', label: 'VIX (right axis)' },
]

type Props = {
  visible: Record<IndexKey, boolean>
  onToggle: (id: IndexKey) => void
}

export default function ChartLegend({ visible, onToggle }: Props) {
  return (
    <div className="legend" role="group" aria-label="Chart legend">
      <span className="badge badge-success">▲ Increasing line</span>
      <span className="badge badge-danger">▼ Decreasing line</span>
      {ENTRIES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="chip"
          aria-pressed={visible[entry.id]}
          onClick={() => onToggle(entry.id)}
        >
          <svg className="chip-check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <svg className="swatch" viewBox="0 0 24 8" aria-hidden="true">
            <line className={`ln ln-${entry.id}`} x1="0" y1="4" x2="24" y2="4" />
          </svg>
          {entry.label}
        </button>
      ))}
    </div>
  )
}
