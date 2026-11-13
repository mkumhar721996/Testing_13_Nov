import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { MarketStore, Series } from '../../src/stores/market.js';
import type { WatchlistItem, WatchlistStore } from '../../src/stores/watchlist.js';
import { downsample, parseRange, rangeStart } from '../../src/validation/market.js';

const now = new Date('2026-11-13T12:00:00Z');

class FakeMarket implements MarketStore {
  calls: { symbol: string; from: Date; to: Date }[] = [];
  constructor(private data: Record<string, { name: string; values: number[] }>) {}
  async series(symbol: string, from: Date, to: Date): Promise<Series | null> {
    this.calls.push({ symbol, from, to });
    const row = this.data[symbol];
    if (!row) return null;
    return {
      symbol,
      name: row.name,
      points: row.values.map((value, i) => ({ at: new Date(from.getTime() + i * 1000).toISOString(), value })),
    };
  }
}

class FakeWatchlist implements WatchlistStore {
  constructor(private rows: (WatchlistItem & { userId: string; position: number })[]) {}
  async listForUser(userId: string) {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => a.position - b.position)
      .map(({ symbol, name }) => ({ symbol, name }));
  }
}

const watch = [
  { userId: 'user-1', symbol: 'MSFT', name: 'Microsoft', position: 2 },
  { userId: 'user-1', symbol: 'AAPL', name: 'Apple', position: 1 },
  { userId: 'user-2', symbol: 'NVDA', name: 'Nvidia', position: 1 },
];

describe('market API', () => {
  const market = new FakeMarket({
    '^GSPC': { name: 'S&P 500', values: [5371.8, 5380, 5420.11, 5412.3].map((v, i) => (i === 0 ? 5367.9 : v)) },
    '^IXIC': { name: 'Nasdaq', values: [17000, 17218.55] },
    '^DJI': { name: 'Dow', values: [39900, 39870.1] },
    AAPL: { name: 'Apple', values: [188, 189.42] },
  });
  const build = (user: string | null = 'user-1', watchRows = watch) =>
    buildApp({
      resolveUserId: async () => user ?? undefined,
      market,
      watchlist: new FakeWatchlist(watchRows),
      now: () => now,
    });
  const get = (range: string, symbol?: string, app = build()) =>
    app.inject({
      method: 'GET',
      url: `/market/overview?range=${range}${symbol ? `&symbol=${symbol}` : ''}`,
    });

  it('returns the four indices in order with stats from their window (AC 4, 12)', async () => {
    const res = await get('1D', 'AAPL');
    expect(res.statusCode).toBe(200);
    expect(res.json().indices.map((i: { key: string }) => i.key)).toEqual(['spx', 'ndx', 'dji', 'vix']);
    expect(res.json().indices[0]).toMatchObject({
      level: 5412.3,
      low: 5367.9,
      high: 5420.11,
      changePct: expect.closeTo(0.83, 1),
    });
    expect(res.json().symbol).toMatchObject({ symbol: 'AAPL', price: 189.42 });
  });

  it('queries a window per range (AC 2, 3)', async () => {
    await get('1W');
    expect(market.calls.at(-1)!.from.toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(rangeStart('1D', now).toISOString()).toBe('2026-11-12T12:00:00.000Z');
    expect(rangeStart('1M', now).toISOString()).toBe('2026-10-13T12:00:00.000Z');
    expect(rangeStart('1Y', now).toISOString()).toBe('2025-11-13T12:00:00.000Z');
  });

  it('rejects a bad range, a foreign symbol and a signed-out caller (AC 6, 11)', async () => {
    expect((await get('9Y')).statusCode).toBe(400);
    const res = await get('1D', 'ZZZZ');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ errors: { symbol: 'Choose a symbol from your watchlist.' } });
    expect((await get('1D', 'NVDA')).statusCode).toBe(400);
    expect((await get('1D', undefined, build(null))).statusCode).toBe(401);
  });

  it('lists only the caller’s watchlist in position order', async () => {
    const res = await build().inject({ method: 'GET', url: '/watchlist' });
    expect(res.json().symbols.map((s: { symbol: string }) => s.symbol)).toEqual(['AAPL', 'MSFT']);
    expect((await build(null).inject({ method: 'GET', url: '/watchlist' })).statusCode).toBe(401);
  });

  it('works with an empty watchlist', async () => {
    const res = await get('1D', undefined, build('user-1', []));
    expect(res.json().symbol).toBeNull();
    expect(res.json().indices).toHaveLength(4);
  });

  it('returns nulls for an index without data', async () => {
    const res = await get('1D');
    expect(res.statusCode).toBe(200);
    expect(res.json().indices[3]).toMatchObject({ key: 'vix', level: null, changePct: null, points: [] });
  });
});

describe('market validation', () => {
  it('parses ranges', () => {
    expect(parseRange('1M')).toBe('1M');
    expect(parseRange('2D')).toBeNull();
    expect(parseRange(undefined)).toBeNull();
  });
  it('downsamples keeping first and last', () => {
    const src = Array.from({ length: 500 }, (_, i) => i);
    const out = downsample(src, 120);
    expect(out).toHaveLength(120);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(499);
    expect(downsample([1, 2, 3], 120)).toEqual([1, 2, 3]);
  });
});

describe('migration 002', () => {
  it('only adds market tables', async () => {
    const sql = await readFile('migrations/002_create_market_data.sql', 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS price_points/);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
    expect(sql).not.toMatch(/ALTER TABLE expenses|DROP /i);
  });
});
