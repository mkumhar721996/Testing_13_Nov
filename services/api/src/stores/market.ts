import { getPool } from '../db.js';

export type Point = { at: string; value: number };
export type Series = { symbol: string; name: string; points: Point[] };

export interface MarketStore {
  /** Points inside [from, to], oldest first; null when the symbol is unknown. */
  series(symbol: string, from: Date, to: Date): Promise<Series | null>;
}

export const pgMarketStore: MarketStore = {
  async series(symbol, from, to) {
    const pool = getPool();
    const inst = await pool.query<{ name: string }>('SELECT name FROM instruments WHERE symbol = $1', [symbol]);
    if (inst.rowCount === 0) return null;
    const { rows } = await pool.query<{ at: Date; price: string }>(
      'SELECT at, price FROM price_points WHERE symbol = $1 AND at BETWEEN $2 AND $3 ORDER BY at',
      [symbol, from, to],
    );
    return {
      symbol,
      name: inst.rows[0].name,
      points: rows.map((r) => ({ at: r.at.toISOString(), value: Number(r.price) })),
    };
  },
};
