import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { MoverStore, Quote } from '../../src/stores/movers.js';

const now = new Date('2026-11-13T12:00:00Z');

class FakeMovers implements MoverStore {
  calls: { from: Date; to: Date }[] = [];
  constructor(private rows: Quote[] = []) {}
  async quotes(from: Date, to: Date): Promise<Quote[]> {
    this.calls.push({ from, to });
    return this.rows;
  }
}

const q = (symbol: string, name: string, open: number, last: number): Quote => ({ symbol, name, open, last });

const rows = [
  q('A', 'Alpha', 100, 110),
  q('B', 'Bravo', 100, 108),
  q('C', 'Charlie', 100, 106),
  q('D', 'Delta', 100, 104),
  q('E', 'Echo', 100, 102),
  q('V', 'Vee', 100, 99),
  q('W', 'Whiskey', 100, 98),
  q('X', 'Xray', 100, 90),
  q('Y', 'Yankee', 100, 92),
  q('Z', 'Zulu', 100, 94),
  q('FLAT', 'Flat', 50, 50),
  q('ZERO', 'Zero open', 0, 5),
];

const build = (movers: MoverStore, user: string | null = 'user-1') =>
  buildApp({ resolveUserId: async () => user ?? undefined, movers, now: () => now });

describe('movers API', () => {
  it('lists the top gainers and losers, biggest move first', async () => {
    const movers = new FakeMovers(rows);
    const res = await build(movers).inject({ method: 'GET', url: '/market/movers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.gainers.map((m: { symbol: string }) => m.symbol)).toEqual(['A', 'B', 'C']);
    expect(body.losers.map((m: { symbol: string }) => m.symbol)).toEqual(['X', 'Y', 'Z']);
    expect(body.gainers[0]).toEqual({ symbol: 'A', name: 'Alpha', price: 110, changePct: 10 });
  });

  it('leaves out flat and zero-open symbols', async () => {
    const res = await build(new FakeMovers(rows)).inject({ method: 'GET', url: '/market/movers' });
    const all = [...res.json().gainers, ...res.json().losers].map((m: { symbol: string }) => m.symbol);
    expect(all).not.toContain('FLAT');
    expect(all).not.toContain('ZERO');
  });

  it('breaks ties by symbol', async () => {
    const tied = [q('B', 'B', 100, 105), q('A', 'A', 100, 105)];
    const res = await build(new FakeMovers(tied)).inject({ method: 'GET', url: '/market/movers' });
    expect(res.json().gainers.map((m: { symbol: string }) => m.symbol)).toEqual(['A', 'B']);
  });

  it('asks the store for the overview 1D window', async () => {
    const movers = new FakeMovers(rows);
    await build(movers).inject({ method: 'GET', url: '/market/movers' });
    expect(movers.calls).toEqual([{ from: new Date('2026-11-12T12:00:00Z'), to: now }]);
  });

  it('returns empty lists when nothing is seeded', async () => {
    const res = await build(new FakeMovers()).inject({ method: 'GET', url: '/market/movers' });
    expect(res.json()).toEqual({ gainers: [], losers: [] });
  });

  it('requires a signed-in user', async () => {
    const res = await build(new FakeMovers(rows), null).inject({ method: 'GET', url: '/market/movers' });
    expect(res.statusCode).toBe(401);
  });
});
