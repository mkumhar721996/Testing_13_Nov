import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Category, CategoryStore } from '../../src/stores/categories.js';
import type {
  Expense,
  ExpenseFilters,
  ExpensePage,
  ExpenseStore,
  ExpenseView,
  NewExpense,
} from '../../src/stores/expenses.js';
import { parseListQuery, validateExpenseInput } from '../../src/validation/expense.js';

class FakeExpenses implements ExpenseStore {
  created: (NewExpense & { userId: string })[] = [];
  async create(userId: string, input: NewExpense): Promise<Expense> {
    this.created.push({ userId, ...input });
    return { id: 'exp-1', userId, ...input };
  }
  listCalls: { userId: string; filters: ExpenseFilters; page: number }[] = [];
  views: (ExpenseView & { userId: string })[] = [
    { id: 'u1-a', userId: 'user-1', amount: '18.50', date: '2026-11-13', categoryId: 'cat-food', categoryName: 'Food', description: 'Lunch', createdAt: '2026-11-13T10:00:00.000Z' },
    { id: 'u1-b', userId: 'user-1', amount: '9.00', date: '2026-11-01', categoryId: 'cat-travel', categoryName: 'Travel', description: null, createdAt: '2026-11-01T10:00:00.000Z' },
    { id: 'u2-a', userId: 'user-2', amount: '5.00', date: '2026-11-02', categoryId: 'cat-work', categoryName: 'Work', description: 'Secret', createdAt: '2026-11-02T10:00:00.000Z' },
  ];
  async list(userId: string, filters: ExpenseFilters, page: number, pageSize: number): Promise<ExpensePage> {
    this.listCalls.push({ userId, filters, page });
    const own = this.views.filter((v) => v.userId === userId).map(({ userId: _u, ...v }) => v);
    return { items: own, page, pageSize, total: own.length };
  }
  async get(userId: string, id: string) {
    const v = this.views.find((x) => x.id === id && x.userId === userId);
    if (!v) return undefined;
    const { userId: _u, ...view } = v;
    return view;
  }
}

class FakeCategories implements CategoryStore {
  constructor(private rows: (Category & { userId: string })[]) {}
  async listForUser(userId: string) {
    return this.rows.filter((r) => r.userId === userId).map(({ id, name }) => ({ id, name }));
  }
  async existsForUser(userId: string, id: string) {
    return this.rows.some((r) => r.userId === userId && r.id === id);
  }
}

const valid = { amount: '18.50', date: '2026-11-13', categoryId: 'cat-food', description: 'Lunch' };
const rows = [
  { id: 'cat-food', name: 'Food', userId: 'user-1' },
  { id: 'cat-travel', name: 'Travel', userId: 'user-1' },
  { id: 'cat-work', name: 'Work', userId: 'user-2' },
];

describe('expenses API', () => {
  let store: FakeExpenses;
  const build = (user: string | null = 'user-1') =>
    buildApp({
      resolveUserId: async () => user ?? undefined,
      expenses: store,
      categories: new FakeCategories(rows),
      today: () => '2026-11-13',
    });
  const post = (payload: object, app = build()) =>
    app.inject({ method: 'POST', url: '/expenses', payload });

  beforeEach(() => {
    store = new FakeExpenses();
  });

  it('saves amount, date, category and description for the signed-in user (AC 1, 8)', async () => {
    const res = await post(valid);
    expect(res.statusCode).toBe(201);
    expect(store.created[0]).toMatchObject({
      userId: 'user-1',
      amount: '18.50',
      date: '2026-11-13',
      categoryId: 'cat-food',
      description: 'Lunch',
    });
  });

  it('ignores a userId in the body (AC 8)', async () => {
    await post({ ...valid, userId: 'someone-else' });
    expect(store.created[0].userId).toBe('user-1');
  });

  it('rejects an unauthenticated request with 401 (AC 8)', async () => {
    const res = await post(valid, build(null));
    expect(res.statusCode).toBe(401);
    expect(store.created).toHaveLength(0);
  });

  it.each([undefined, ''])('saves with description %j (AC 2)', async (description) => {
    const res = await post({ ...valid, description });
    expect(res.statusCode).toBe(201);
    expect(store.created[0].description).toBeNull();
  });

  it.each(['amount', 'date', 'categoryId'])('rejects a missing %s (AC 3)', async (key) => {
    const res = await post({ ...valid, [key]: '' });
    expect(res.statusCode).toBe(400);
    expect(store.created).toHaveLength(0);
  });

  it('rejects amount 0 with a message (AC 4)', async () => {
    const res = await post({ ...valid, amount: '0' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.amount).toBe('Amount must be greater than zero.');
    expect(store.created).toHaveLength(0);
  });

  it('rejects tomorrow with a message (AC 5)', async () => {
    const res = await post({ ...valid, date: '2026-11-14' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.date).toBe('Date cannot be in the future.');
    expect(store.created).toHaveLength(0);
  });

  it('accepts today (AC 6)', async () => {
    expect((await post({ ...valid, date: '2026-11-13' })).statusCode).toBe(201);
  });

  it("lists only the user's own categories (AC 7)", async () => {
    const res = await build().inject({ method: 'GET', url: '/categories' });
    expect(res.statusCode).toBe(200);
    expect(res.json().categories.map((c: { name: string }) => c.name)).toEqual(['Food', 'Travel']);
  });

  it("rejects another user's category (AC 8)", async () => {
    const res = await post({ ...valid, categoryId: 'cat-work' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.category).toBeDefined();
    expect(store.created).toHaveLength(0);
  });

  it('ignores a currency in the body (AC 9)', async () => {
    const res = await post({ ...valid, currency: 'USD' });
    expect(res.statusCode).toBe(201);
    expect(store.created[0]).not.toHaveProperty('currency');
    expect(res.json()).not.toHaveProperty('currency');
  });

  it('directs a user with no categories to create one (AC 12, 13)', async () => {
    const res = await post(valid, build('user-3'));
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.category).toBe('Create a category first.');
    expect(store.created).toHaveLength(0);
  });
});

describe('browse expenses API', () => {
  let store: FakeExpenses;
  const build = (user: string | null = 'user-1') =>
    buildApp({
      resolveUserId: async () => user ?? undefined,
      expenses: store,
      categories: new FakeCategories(rows),
      today: () => '2026-11-13',
    });
  const get = (url: string, app = build()) => app.inject({ method: 'GET', url });
  const UUID_OWN = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    store = new FakeExpenses();
  });

  it('lists only the signed-in user\'s expenses, ignoring a userId param (AC 1)', async () => {
    const res = await get('/expenses?userId=user-2');
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((e: { id: string }) => e.id)).toEqual(['u1-a', 'u1-b']);
    expect(res.json().total).toBe(2);
    expect(res.json().pageSize).toBe(20);
    expect(store.listCalls[0].userId).toBe('user-1');
  });

  it('requires a signed-in user', async () => {
    expect((await get('/expenses', build(null))).statusCode).toBe(401);
    expect((await get('/expenses/u1-a', build(null))).statusCode).toBe(401);
  });

  it('passes filters and page to the store (AC 4, 5, 6, 10)', async () => {
    await get('/expenses?q=%20lunch%20&categoryId=cat-food&from=2026-11-10&to=2026-11-20&page=2');
    expect(store.listCalls[0]).toEqual({
      userId: 'user-1',
      filters: { q: 'lunch', categoryId: 'cat-food', from: '2026-11-10', to: '2026-11-20' },
      page: 2,
    });
  });

  it.each(['0', 'abc', '-3', '1.5'])('treats page %s as page 1 (AC 3)', async (page) => {
    await get(`/expenses?page=${page}`);
    expect(store.listCalls[0].page).toBe(1);
  });

  it('rejects a from date after the to date (AC 6)', async () => {
    const res = await get('/expenses?from=2026-11-20&to=2026-11-10');
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.dateRange).toBe('The from date must be on or before the to date.');
    expect((await get('/expenses?from=nope')).statusCode).toBe(400);
  });

  it('shows the detail of an own expense (AC 7)', async () => {
    store.views[0].id = UUID_OWN;
    const res = await get(`/expenses/${UUID_OWN}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ amount: '18.50', date: '2026-11-13', categoryName: 'Food', description: 'Lunch' });
  });

  it('returns 404 for another user\'s expense without leaking it (AC 11)', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    store.views[2].id = other;
    const res = await get(`/expenses/${other}`);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
    expect(res.body).not.toContain('Secret');
  });

  it('returns 404 for an id that is not a uuid', async () => {
    expect((await get('/expenses/not-a-uuid')).statusCode).toBe(404);
  });
});

describe('parseListQuery', () => {
  it('defaults to no filters on page 1', () => {
    expect(parseListQuery({})).toEqual({ ok: true, value: { filters: {}, page: 1 } });
  });
  it('ignores an empty q', () => {
    expect(parseListQuery({ q: '  ' })).toEqual({ ok: true, value: { filters: {}, page: 1 } });
  });
});

describe('validateExpenseInput', () => {
  const today = '2026-11-13';
  it.each([
    [{ ...valid, amount: '' }, 'amount', 'Enter an amount.'],
    [{ ...valid, amount: 'abc' }, 'amount', 'Amount must be greater than zero.'],
    [{ ...valid, amount: '-3' }, 'amount', 'Amount must be greater than zero.'],
    [{ ...valid, amount: '1.234' }, 'amount', 'Amount can have at most two decimal places.'],
    [{ ...valid, date: '' }, 'date', 'Enter a date.'],
    [{ ...valid, date: '2026-11-14' }, 'date', 'Date cannot be in the future.'],
    [{ ...valid, categoryId: '' }, 'category', 'Choose a category.'],
  ])('reports %j', (body, field, message) => {
    const r = validateExpenseInput(body, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r.errors as Record<string, string>)[field]).toBe(message);
  });

  it('trims the description', () => {
    const r = validateExpenseInput({ ...valid, description: '  hi  ' }, today);
    expect(r.ok && r.value.description).toBe('hi');
  });
});
