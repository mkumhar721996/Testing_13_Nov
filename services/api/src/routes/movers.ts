import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import type { MoverStore } from '../stores/movers.js';
import { rangeStart } from '../validation/market.js';

export type Mover = { symbol: string; name: string; price: number; changePct: number };
export const MOVERS_LIMIT = 3;

const bySymbol = (a: Mover, b: Mover) => a.symbol.localeCompare(b.symbol);

export const moverRoutes =
  (deps: { movers: MoverStore; now: () => Date }, requireUser: preHandlerAsyncHookHandler): FastifyPluginAsync =>
  async (app) => {
    app.get('/market/movers', { preHandler: requireUser }, async () => {
      const to = deps.now();
      const quotes = await deps.movers.quotes(rangeStart('1D', to), to);
      const movers: Mover[] = quotes
        .filter((q) => q.open !== 0)
        .map((q) => ({ symbol: q.symbol, name: q.name, price: q.last, changePct: ((q.last - q.open) / q.open) * 100 }));
      return {
        gainers: movers
          .filter((m) => m.changePct > 0)
          .sort((a, b) => b.changePct - a.changePct || bySymbol(a, b))
          .slice(0, MOVERS_LIMIT),
        losers: movers
          .filter((m) => m.changePct < 0)
          .sort((a, b) => a.changePct - b.changePct || bySymbol(a, b))
          .slice(0, MOVERS_LIMIT),
      };
    });
  };
