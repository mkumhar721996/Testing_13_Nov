const MINUS = '−'

export type Tone = 'success' | 'danger' | 'neutral'

export function formatLevel(n: number | null, decimals: number): string {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
}

export function formatChange(pct: number | null): { text: string; tone: Tone } {
  if (pct === null) return { text: '—', tone: 'neutral' }
  const up = pct >= 0
  const digits = Math.abs(pct) < 10 ? 2 : 1
  const sign = pct > 0 ? '+' : pct < 0 ? MINUS : ''
  return { text: `${up ? '▲' : '▼'} ${sign}${Math.abs(pct).toFixed(digits)}%`, tone: up ? 'success' : 'danger' }
}

/** Signed percent for axis labels and the chart readout, e.g. "+1%" or "−0.5%". */
export function formatSignedPct(pct: number, digits: number): string {
  return `${pct > 0 ? '+' : pct < 0 ? MINUS : ''}${Math.abs(pct).toFixed(digits)}%`
}
