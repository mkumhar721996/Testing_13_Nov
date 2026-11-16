import Fastify, { type FastifyInstance } from 'fastify';
import { noUser, requireUser, type ResolveUserId } from './auth.js';
import { categoryRoutes } from './routes/categories.js';
import { expenseRoutes } from './routes/expenses.js';
import { healthRoutes } from './routes/health.js';
import { marketRoutes } from './routes/market.js';
import { watchlistRoutes } from './routes/watchlist.js';
import { pgMarketStore, type MarketStore } from './stores/market.js';
import { pgWatchlistStore, type WatchlistStore } from './stores/watchlist.js';
import { pgCategoryStore, type CategoryStore } from './stores/categories.js';
import { pgExpenseStore, type ExpenseStore } from './stores/expenses.js';

export type AppOptions = {
  resolveUserId?: ResolveUserId;
  expenses?: ExpenseStore;
  categories?: CategoryStore;
  market?: MarketStore;
  watchlist?: WatchlistStore;
  now?: () => Date;
  /** Today as YYYY-MM-DD; defaults to the UTC date. */
  today?: () => string;
};

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  if (!opts.resolveUserId && process.env.NODE_ENV === 'production') {
    // Without a session resolver every /categories and /expenses call would 401.
    throw new Error('No session resolver configured: wire the accounts story before running in production');
  }
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const auth = requireUser(opts.resolveUserId ?? noUser);
  const categories = opts.categories ?? pgCategoryStore;
  const today = opts.today ?? (() => new Date().toISOString().slice(0, 10));

  app.register(healthRoutes);
  app.register(categoryRoutes(categories, auth));
  app.register(expenseRoutes({ expenses: opts.expenses ?? pgExpenseStore, categories, today }, auth));
  const watchlist = opts.watchlist ?? pgWatchlistStore;
  app.register(watchlistRoutes(watchlist, auth));
  app.register(
    marketRoutes(
      { market: opts.market ?? pgMarketStore, watchlist, now: opts.now ?? (() => new Date()) },
      auth,
    ),
  );
  return app;
}
