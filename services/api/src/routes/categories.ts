import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import type { CategoryStore } from '../stores/categories.js';

export const categoryRoutes =
  (categories: CategoryStore, requireUser: preHandlerAsyncHookHandler): FastifyPluginAsync =>
  async (app) => {
    app.get('/categories', { preHandler: requireUser }, async (req) => ({
      categories: await categories.listForUser(req.userId!),
    }));
  };
