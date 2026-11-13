import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import type { CategoryStore } from '../stores/categories.js';
import type { ExpenseStore } from '../stores/expenses.js';
import { parseListQuery, UUID, validateExpenseInput } from '../validation/expense.js';

const PAGE_SIZE = 20;

type Deps = { expenses: ExpenseStore; categories: CategoryStore; today: () => string };

export const expenseRoutes =
  (deps: Deps, requireUser: preHandlerAsyncHookHandler): FastifyPluginAsync =>
  async (app) => {
    app.post('/expenses', { preHandler: requireUser }, async (req, reply) => {
      const userId = req.userId!;
      const result = validateExpenseInput(req.body, deps.today());
      if (!result.ok) return reply.code(400).send({ errors: result.errors });

      if (!(await deps.categories.existsForUser(userId, result.value.categoryId))) {
        const hasAny = (await deps.categories.listForUser(userId)).length > 0;
        const category = hasAny ? 'Choose a category.' : 'Create a category first.';
        return reply.code(400).send({ errors: { category } });
      }

      const expense = await deps.expenses.create(userId, result.value);
      return reply.code(201).send(expense);
    });

    app.get('/expenses', { preHandler: requireUser }, async (req, reply) => {
      const parsed = parseListQuery(req.query);
      if (!parsed.ok) return reply.code(400).send({ errors: parsed.errors });
      const { filters, page } = parsed.value;
      return deps.expenses.list(req.userId!, filters, page, PAGE_SIZE);
    });

    app.get<{ Params: { id: string } }>(
      '/expenses/:id',
      { preHandler: requireUser },
      async (req, reply) => {
        const expense = UUID.test(req.params.id)
          ? await deps.expenses.get(req.userId!, req.params.id)
          : undefined;
        if (!expense) return reply.code(404).send({ error: 'not_found' });
        return expense;
      },
    );
  };
