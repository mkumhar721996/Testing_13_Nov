import type { Section } from './useDashboardData'
import './dashboard-states.css'

function Icon({ id }: { id: 'loader' | 'alert' }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {id === 'loader' ? (
        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </>
      )}
    </svg>
  )
}

type SectionCopy = { id: Section; title: string; missing: string; message: string; reload: string }

const SECTION_COPY: SectionCopy[] = [
  {
    id: 'overview',
    title: 'Index stats and price chart',
    missing: 'The index stats and price chart are missing.',
    message: 'The index stats and chart could not be loaded.',
    reload: 'Reload chart',
  },
  {
    id: 'watchlist',
    title: 'Watchlist',
    missing: 'The watchlist is missing.',
    message: 'The watchlist could not be loaded.',
    reload: 'Reload watchlist',
  },
]

const copyFor = (sections: Section[]) => SECTION_COPY.filter((c) => sections.includes(c.id))

export function LoadingState() {
  return (
    <div className="stack">
      <p className="state-title text-muted m-0" role="status">
        <span className="spinner" aria-hidden="true" /> Loading market data…
      </p>
      <div className="grid">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="main-row">
        <div className="skeleton skeleton-stat" />
        <div className="skeleton skeleton-chart" />
      </div>
    </div>
  )
}

export function NoMarketDataState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="empty-state" role="status">
      <h3 className="m-0">No market data yet</h3>
      <p className="m-0">
        Quotes are not available right now, for example outside trading hours or before the first update. Refresh to
        check again.
      </p>
      <button type="button" className="btn btn-primary" onClick={onRefresh}>
        <Icon id="loader" /> Refresh
      </button>
    </div>
  )
}

export function PartialFailureBanner({ failed, onRetryAll }: { failed: Section[]; onRetryAll: () => void }) {
  return (
    <div className="alert alert-warning" role="alert">
      <Icon id="alert" />
      <div className="alert-row">
        <div className="alert-body">
          <strong>Some dashboard data could not be loaded</strong>
          <span>{copyFor(failed).map((c) => c.missing).join(' ')} Everything else is up to date.</span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRetryAll}>
          Try again
        </button>
      </div>
    </div>
  )
}

export function FailedSectionCard({ section, onReload }: { section: Section; onReload: (s: Section) => void }) {
  const copy = SECTION_COPY.find((c) => c.id === section)!
  return (
    <section className="card failed" aria-label={copy.title}>
      <h3>{copy.title}</h3>
      <p className="text-muted m-0">{copy.message}</p>
      <button type="button" className="btn btn-secondary" onClick={() => onReload(section)}>
        {copy.reload}
      </button>
    </section>
  )
}

export function TotalFailureState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="stack">
      <div className="alert alert-danger" role="alert">
        <Icon id="alert" />
        <span>
          Market data could not be loaded. Check your connection and try again; the last update may be out of date.
        </span>
      </div>
      <div className="empty-state">
        <h3 className="m-0">Quotes are unavailable right now</h3>
        <p className="m-0">The range, index stats and chart will return once the data loads.</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <Icon id="loader" /> Try again
        </button>
      </div>
    </div>
  )
}

export { Icon }
