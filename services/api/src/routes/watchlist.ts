import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import type { WatchlistStore } from '../stores/watchlist.js';

export const watchlistRoutes =
  (watchlist: WatchlistStore, requireUser: preHandlerAsyncHookHandler): FastifyPluginAsync =>
  async (app) => {
    app.get('/watchlist', { preHandler: requireUser }, async (req) => ({
      symbols: await watchlist.listForUser(req.userId!),
    }));
  };
