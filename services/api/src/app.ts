import Fastify, { type FastifyInstance } from 'fastify';
import { noUser, requireUser, type ResolveUserId } from './auth.js';
import { categoryRoutes } from './routes/categories.js';
import { expenseRoutes } from './routes/expenses.js';
import { healthRoutes } from './routes/health.js';
import { pgCategoryStore, type CategoryStore } from './stores/categories.js';
import { pgExpenseStore, type ExpenseStore } from './stores/expenses.js';

export type AppOptions = {
  resolveUserId?: ResolveUserId;
  expenses?: ExpenseStore;
  categories?: CategoryStore;
  /** Today as YYYY-MM-DD; defaults to the UTC date. */
  today?: () => string;
};

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const auth = requireUser(opts.resolveUserId ?? noUser);
  const categories = opts.categories ?? pgCategoryStore;
  const today = opts.today ?? (() => new Date().toISOString().slice(0, 10));

  app.register(healthRoutes);
  app.register(categoryRoutes(categories, auth));
  app.register(expenseRoutes({ expenses: opts.expenses ?? pgExpenseStore, categories, today }, auth));
  return app;
}
