import { getPool } from '../db.js';

export type WatchlistItem = { symbol: string; name: string };

export interface WatchlistStore {
  listForUser(userId: string): Promise<WatchlistItem[]>;
}

export const pgWatchlistStore: WatchlistStore = {
  async listForUser(userId) {
    const { rows } = await getPool().query<WatchlistItem>(
      `SELECT w.symbol, i.name FROM watchlist_items w
       JOIN instruments i ON i.symbol = w.symbol
       WHERE w.user_id = $1 ORDER BY w.position`,
      [userId],
    );
    return rows;
  },
};
