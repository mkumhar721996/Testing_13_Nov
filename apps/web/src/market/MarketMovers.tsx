import { useCallback, useEffect, useState } from 'react'
import { getMovers, type Mover, type MoversResponse } from './api'
import { formatLevel, formatSignedPct } from './format'
import './movers.css'

type State = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; data: MoversResponse }

function MoversTable({ id, title, movers, up, none }: { id: string; title: string; movers: Mover[]; up: boolean; none: string }) {
  return (
    <div className="movers-list">
      <h4 id={id}>{title}</h4>
      {movers.length === 0 ? (
        <p className="text-muted m-0">{none}</p>
      ) : (
        <div className="table-wrap">
          <table className="table" aria-labelledby={id}>
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Name</th>
                <th className="num">Last price</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {movers.map((m) => (
                <tr key={m.symbol}>
                  <th scope="row">
                    <strong>{m.symbol}</strong>
                  </th>
                  <td className="name">{m.name}</td>
                  <td className="num">{formatLevel(m.price, 2)}</td>
                  <td className="num">
                    <span className={`badge ${up ? 'badge-success' : 'badge-danger'}`}>
                      {up ? '▲' : '▼'} {formatSignedPct(m.changePct, 1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function MarketMovers() {
  const [state, setState] = useState<State>({ phase: 'loading' })

  const load = useCallback(() => {
    setState({ phase: 'loading' })
    getMovers().then(
      (data) => setState({ phase: 'ready', data }),
      () => setState({ phase: 'error' }),
    )
  }, [])

  useEffect(load, [load])

  if (state.phase === 'loading') {
    return (
      <div className="stack">
        <p className="text-muted m-0" role="status">
          Loading market data…
        </p>
        <div className="movers-grid">
          <div className="skeleton skeleton-movers" />
          <div className="skeleton skeleton-movers" />
        </div>
      </div>
    )
  }

  const header = (
    <div>
      <h3 id="mv-title">Top movers today</h3>
      <p className="text-muted text-sm m-0">Largest moves in today's session. For reference only.</p>
    </div>
  )

  if (state.phase === 'error') {
    return (
      <section className="card stack" aria-labelledby="mv-title">
        {header}
        <div className="alert alert-danger" role="alert">
          Top movers could not be loaded. Check your connection and try again.
        </div>
        <div>
          <button type="button" className="btn btn-secondary" onClick={load}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  const { gainers, losers } = state.data
  if (gainers.length === 0 && losers.length === 0) {
    return (
      <section className="card stack" aria-labelledby="mv-title">
        {header}
        <div className="empty-state">
          <h4 className="m-0">No movers yet today</h4>
          <p className="m-0">Gainers and losers appear once the market has traded for a while. Check again shortly.</p>
          <button type="button" className="btn btn-secondary" onClick={load}>
            Check again
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card stack" aria-labelledby="mv-title">
      {header}
      <div className="movers-grid">
        <MoversTable id="gain-title" title="Top gainers" movers={gainers} up none="No gainers yet today" />
        <MoversTable id="lose-title" title="Top losers" movers={losers} up={false} none="No losers yet today" />
      </div>
    </section>
  )
}
