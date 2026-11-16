import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import type { MarketStore, Point } from '../stores/market.js';
import type { WatchlistStore } from '../stores/watchlist.js';
import { downsample, parseRange, rangeStart } from '../validation/market.js';

const MAX_POINTS = 120;

const INDICES = [
  { key: 'spx', symbol: '^GSPC', name: 'S&P 500' },
  { key: 'ndx', symbol: '^IXIC', name: 'Nasdaq' },
  { key: 'dji', symbol: '^DJI', name: 'Dow' },
  { key: 'vix', symbol: '^VIX', name: 'VIX' },
] as const;

type Stats = { level: number | null; changePct: number | null; low: number | null; high: number | null; points: Point[] };

function stats(points: Point[]): Stats {
  if (points.length === 0) return { level: null, changePct: null, low: null, high: null, points: [] };
  const values = points.map((p) => p.value);
  const first = values[0];
  const level = values[values.length - 1];
  return {
    level,
    changePct: first === 0 ? null : ((level - first) / first) * 100,
    low: Math.min(...values),
    high: Math.max(...values),
    points: downsample(points, MAX_POINTS),
  };
}

export const marketRoutes =
  (
    deps: { market: MarketStore; watchlist: WatchlistStore; now: () => Date },
    requireUser: preHandlerAsyncHookHandler,
  ): FastifyPluginAsync =>
  async (app) => {
    app.get('/market/overview', { preHandler: requireUser }, async (req, reply) => {
      const query = req.query as { range?: unknown; symbol?: unknown };
      const range = parseRange(query.range);
      if (!range) return reply.code(400).send({ errors: { range: 'Choose 1D, 1W, 1M or 1Y.' } });

      const requested = typeof query.symbol === 'string' && query.symbol ? query.symbol : null;
      if (requested) {
        const owned = await deps.watchlist.listForUser(req.userId!);
        if (!owned.some((w) => w.symbol === requested)) {
          return reply.code(400).send({ errors: { symbol: 'Choose a symbol from your watchlist.' } });
        }
      }

      const to = deps.now();
      const from = rangeStart(range, to);
      const [symbolSeries, ...indexSeries] = await Promise.all([
        requested ? deps.market.series(requested, from, to) : Promise.resolve(null),
        ...INDICES.map((i) => deps.market.series(i.symbol, from, to)),
      ]);

      const symbol = requested
        ? (() => {
            const s = stats(symbolSeries?.points ?? []);
            return { symbol: requested, price: s.level, changePct: s.changePct, points: s.points };
          })()
        : null;
      const indices = INDICES.map((i, n) => ({
        key: i.key,
        name: i.name,
        ...stats(indexSeries[n]?.points ?? []),
      }));
      return { range, symbol, indices };
    });
  };
