import Fastify, { type FastifyInstance } from 'fastify';
import { noUser, requireUser, type ResolveUserId } from './auth.js';
import { categoryRoutes } from './routes/categories.js';
import { expenseRoutes } from './routes/expenses.js';
import { healthRoutes } from './routes/health.js';
import { organizationRoutes } from './routes/organizations.js';
import { pgOrganizationStore, type OrganizationStore } from './stores/organizations.js';
import { pgCategoryStore, type CategoryStore } from './stores/categories.js';
import { pgExpenseStore, type ExpenseStore } from './stores/expenses.js';

export type AppOptions = {
  resolveUserId?: ResolveUserId;
  expenses?: ExpenseStore;
  organizations?: OrganizationStore;
  categories?: CategoryStore;
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
  app.register(organizationRoutes({ organizations: opts.organizations ?? pgOrganizationStore }, auth));
  return app;
}
