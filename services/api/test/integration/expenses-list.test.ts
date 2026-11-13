import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '../../src/db.js';
import { pgExpenseStore } from '../../src/stores/expenses.js';

// Real-SQL tests: they need a PostgreSQL with the expenses and categories tables.
// Set DATABASE_URL to run them; without it they are skipped.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('pgExpenseStore list and get', () => {
  const user1 = randomUUID();
  const user2 = randomUUID();
  const food = randomUUID();
  const travel = randomUUID();
  const foreignCat = randomUUID();
  let foreignExpense = '';

  const insert = async (
    user: string,
    category: string,
    date: string,
    description: string | null,
    createdAt = new Date().toISOString(),
  ) => {
    const { rows } = await getPool().query<{ id: string }>(
      `INSERT INTO expenses (user_id, category_id, amount, spent_on, description, created_at)
       VALUES ($1, $2, 10, $3, $4, $5) RETURNING id`,
      [user, category, date, description, createdAt],
    );
    return rows[0].id;
  };
  const list = (filters = {}, page = 1) => pgExpenseStore.list(user1, filters, page, 20);

  beforeAll(async () => {
    const pool = getPool();
    for (const [id, user, name] of [
      [food, user1, 'Food'],
      [travel, user1, 'Travel'],
      [foreignCat, user2, 'Work'],
    ]) {
      await pool.query('INSERT INTO categories (id, user_id, name) VALUES ($1, $2, $3)', [
        id,
        user,
        name,
      ]);
    }
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM expenses WHERE user_id = ANY($1)', [[user1, user2]]);
    await pool.query('DELETE FROM categories WHERE user_id = ANY($1)', [[user1, user2]]);
    await pool.end();
  });

  const clear = () => getPool().query('DELETE FROM expenses WHERE user_id = ANY($1)', [[user1, user2]]);

  it('lists only the own expenses, newest date first, later-recorded first on a tie (AC 1, 2, 12)', async () => {
    await clear();
    await insert(user1, food, '2026-11-01', 'first');
    await insert(user1, food, '2026-11-30', 'last');
    await insert(user1, food, '2026-11-15', 'recorded earlier', '2026-11-15T08:00:00Z');
    await insert(user1, food, '2026-11-15', 'recorded later', '2026-11-15T09:00:00Z');
    foreignExpense = await insert(user2, foreignCat, '2026-11-20', 'other user');

    const page = await list();
    expect(page.items.map((e) => e.date)).toEqual([
      '2026-11-30',
      '2026-11-15',
      '2026-11-15',
      '2026-11-01',
    ]);
    expect(page.items[1].description).toBe('recorded later');
    expect(page.items[2].description).toBe('recorded earlier');
    expect(page.total).toBe(4);
  });

  it('pages 20 at a time (AC 3)', async () => {
    await clear();
    for (let day = 1; day <= 25; day++) {
      await insert(user1, food, `2026-10-${String(day).padStart(2, '0')}`, null);
    }
    const p1 = await list();
    const p2 = await list({}, 2);
    expect(p1.items).toHaveLength(20);
    expect(p1.total).toBe(25);
    expect(p2.items.map((e) => e.date)).toEqual([
      '2026-10-05',
      '2026-10-04',
      '2026-10-03',
      '2026-10-02',
      '2026-10-01',
    ]);
  });

  it('searches the description case-insensitively and escapes wildcards (AC 4)', async () => {
    await clear();
    await insert(user1, food, '2026-11-01', 'Team lunch');
    await insert(user1, food, '2026-11-02', 'Taxi to airport');
    await insert(user1, food, '2026-11-03', '100% juice');
    await insert(user1, food, '2026-11-04', 'snake_case');
    await insert(user1, food, '2026-11-05', null);

    expect((await list({ q: 'LUNCH' })).items.map((e) => e.description)).toEqual(['Team lunch']);
    expect((await list({ q: '%' })).items.map((e) => e.description)).toEqual(['100% juice']);
    expect((await list({ q: '_' })).items.map((e) => e.description)).toEqual(['snake_case']);
  });

  it('filters by category (AC 5)', async () => {
    await clear();
    await insert(user1, food, '2026-11-01', 'a');
    await insert(user1, travel, '2026-11-02', 'b');
    const page = await list({ categoryId: food });
    expect(page.items.map((e) => e.categoryName)).toEqual(['Food']);
  });

  it('filters by an inclusive date range (AC 6)', async () => {
    await clear();
    for (const d of ['01', '10', '15', '20', '30']) await insert(user1, food, `2026-11-${d}`, d);
    const page = await list({ from: '2026-11-10', to: '2026-11-20' });
    expect(page.items.map((e) => e.date)).toEqual(['2026-11-20', '2026-11-15', '2026-11-10']);
  });

  it('combines category and date range (AC 10)', async () => {
    await clear();
    await insert(user1, food, '2026-11-15', 'a');
    await insert(user1, travel, '2026-11-15', 'b');
    await insert(user1, food, '2026-11-01', 'c');
    const page = await list({ categoryId: food, from: '2026-11-10', to: '2026-11-20' });
    expect(page.items.map((e) => [e.categoryName, e.date])).toEqual([['Food', '2026-11-15']]);
  });

  it('gets an own expense but not another user\'s (AC 7, 11)', async () => {
    await clear();
    const own = await insert(user1, food, '2026-11-15', 'Team lunch');
    foreignExpense = await insert(user2, foreignCat, '2026-11-20', 'other user');
    expect(await pgExpenseStore.get(user1, own)).toMatchObject({
      amount: '10.00',
      date: '2026-11-15',
      categoryName: 'Food',
      description: 'Team lunch',
    });
    expect(await pgExpenseStore.get(user1, foreignExpense)).toBeUndefined();
  });
});
