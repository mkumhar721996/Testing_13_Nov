export type RangeKey = '1D' | '1W' | '1M' | '1Y';

const RANGES: readonly RangeKey[] = ['1D', '1W', '1M', '1Y'];

export function parseRange(input: unknown): RangeKey | null {
  return RANGES.find((r) => r === input) ?? null;
}

/** Start of the window that ends at `now`. */
export function rangeStart(range: RangeKey, now: Date): Date {
  const d = new Date(now);
  if (range === '1D') d.setUTCDate(d.getUTCDate() - 1);
  else if (range === '1W') d.setUTCDate(d.getUTCDate() - 7);
  else if (range === '1M') d.setUTCMonth(d.getUTCMonth() - 1);
  else d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d;
}

/** At most `max` items at an even stride, always keeping the first and the last. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const last = points.length - 1;
  return Array.from({ length: max }, (_, i) => points[Math.round((i * last) / (max - 1))]);
}
