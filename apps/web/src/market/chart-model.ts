import type { IndexKey, OverviewResponse, Point } from './api'

export type Axis = { ticks: number[]; min: number; max: number; step: number }
export type Direction = 'up' | 'down'
export type ChartModel = {
  /** Percent change since the start of the range: the symbol and S&P 500, Nasdaq and Dow. */
  leftAxis: Axis
  /** VIX level, on its own scale; null when VIX is hidden or has no data. */
  rightAxis: Axis | null
  lines: { key: IndexKey; points: string }[]
  segments: { direction: Direction; points: string }[]
  xLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end' }[]
}

export const PLOT = { x0: 48, x1: 592, y0: 216, y1: 16 }

const values = (points: Point[]) => points.map((p) => p.value)
const percent = (vs: number[]) => vs.map((v) => (vs[0] === 0 ? 0 : (v / vs[0] - 1) * 100))

function niceAxis(min: number, max: number): Axis {
  const raw = Math.max(max - min, 0.1) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const lo = Math.floor(min / step)
  const hi = Math.ceil(max / step)
  const ticks = Array.from({ length: hi - lo + 1 }, (_, k) => +((lo + k) * step).toFixed(6))
  return { ticks, min: ticks[0], max: ticks[ticks.length - 1], step }
}

export const yFor = (axis: Axis, v: number) =>
  PLOT.y0 - ((v - axis.min) / (axis.max - axis.min)) * (PLOT.y0 - PLOT.y1)

const xFor = (i: number, n: number) => PLOT.x0 + (n < 2 ? 0 : (i * (PLOT.x1 - PLOT.x0)) / (n - 1))

const path = (vs: number[], axis: Axis, from = 0, count = vs.length) =>
  vs.map((v, i) => `${xFor(from + i, count).toFixed(0)},${yFor(axis, v).toFixed(0)}`).join(' ')

export function buildChartModel(data: OverviewResponse, visible: Record<IndexKey, boolean>): ChartModel {
  const symbolPct = percent(values(data.symbol?.points ?? []))
  const shared = data.indices
    .filter((i) => i.key !== 'vix' && visible[i.key] && i.points.length > 0)
    .map((i) => ({ key: i.key, pct: percent(values(i.points)) }))
  const leftAxis = niceAxis(
    Math.min(0, ...symbolPct, ...shared.flatMap((s) => s.pct)),
    Math.max(0, ...symbolPct, ...shared.flatMap((s) => s.pct)),
  )

  const vix = data.indices.find((i) => i.key === 'vix')
  const vixValues = visible.vix && vix ? values(vix.points) : []
  const rightAxis = vixValues.length > 0 ? niceAxis(Math.min(...vixValues), Math.max(...vixValues)) : null

  // Drawn last is on top: VIX first, then Dow, Nasdaq and S&P 500.
  const lines = [
    ...(rightAxis ? [{ key: 'vix' as const, points: path(vixValues, rightAxis) }] : []),
    ...[...shared].reverse().map((s) => ({ key: s.key, points: path(s.pct, leftAxis) })),
  ].filter((l) => l.points.includes(' '))

  const segments = symbolPct.slice(1).map((v, i) => ({
    direction: (v >= symbolPct[i] ? 'up' : 'down') as Direction,
    points: path([symbolPct[i], v], leftAxis, i, symbolPct.length),
  }))

  const longest = [data.symbol?.points ?? [], ...data.indices.map((i) => i.points)].reduce((a, b) =>
    b.length > a.length ? b : a,
  )
  const xLabels = longest.length < 2 ? [] : [0, 1, 2, 3, 4].map((k) => {
    const at = longest[Math.round((k * (longest.length - 1)) / 4)].at
    return {
      x: PLOT.x0 + (k * (PLOT.x1 - PLOT.x0)) / 4,
      text: formatTick(at, data.range),
      anchor: (k === 0 ? 'start' : k === 4 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
    }
  })

  return { leftAxis, rightAxis, lines, segments, xLabels }
}

function formatTick(at: string, range: OverviewResponse['range']): string {
  const options: Intl.DateTimeFormatOptions =
    range === '1D'
      ? { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }
      : range === '1Y'
        ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
        : { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat('en-US', options).format(new Date(at))
}
