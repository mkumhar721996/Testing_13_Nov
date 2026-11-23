import { getPool } from '../db.js';

export type Quote = { symbol: string; name: string; open: number; last: number };

export interface MoverStore {
  /** First and last price inside [from, to] for every equity with a point there. */
  quotes(from: Date, to: Date): Promise<Quote[]>;
}

export const pgMoverStore: MoverStore = {
  async quotes(from, to) {
    const { rows } = await getPool().query<{ symbol: string; name: string; open: string; last: string }>(
      `SELECT i.symbol, i.name, f.price AS open, l.price AS last
       FROM instruments i
       JOIN LATERAL (SELECT price FROM price_points WHERE symbol = i.symbol AND at BETWEEN $1 AND $2 ORDER BY at ASC LIMIT 1) f ON true
       JOIN LATERAL (SELECT price FROM price_points WHERE symbol = i.symbol AND at BETWEEN $1 AND $2 ORDER BY at DESC LIMIT 1) l ON true
       WHERE i.kind = 'equity'`,
      [from, to],
    );
    return rows.map((r) => ({ symbol: r.symbol, name: r.name, open: Number(r.open), last: Number(r.last) }));
  },
};
