import { getPool } from '../db.js';

export type NewExpense = {
  amount: string;
  date: string;
  categoryId: string;
  description: string | null;
};

export type Expense = NewExpense & { id: string; userId: string };

export type ExpenseFilters = { q?: string; categoryId?: string; from?: string; to?: string };

export type ExpenseView = {
  id: string;
  amount: string;
  date: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  createdAt: string;
};

export type ExpensePage = { items: ExpenseView[]; page: number; pageSize: number; total: number };

export interface ExpenseStore {
  create(userId: string, input: NewExpense): Promise<Expense>;
  list(
    userId: string,
    filters: ExpenseFilters,
    page: number,
    pageSize: number,
  ): Promise<ExpensePage>;
  get(userId: string, id: string): Promise<ExpenseView | undefined>;
}

const VIEW_COLUMNS = `e.id, e.amount::text AS amount, to_char(e.spent_on, 'YYYY-MM-DD') AS date,
  e.category_id AS "categoryId", c.name AS "categoryName", e.description,
  to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`;

const FROM = 'FROM expenses e JOIN categories c ON c.id = e.category_id';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export const pgExpenseStore: ExpenseStore = {
  async create(userId, input) {
    const { rows } = await getPool().query<Expense>(
      `INSERT INTO expenses (user_id, category_id, amount, spent_on, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id AS "userId", category_id AS "categoryId",
                 amount::text AS amount, to_char(spent_on, 'YYYY-MM-DD') AS date, description`,
      [userId, input.categoryId, input.amount, input.date, input.description],
    );
    return rows[0];
  },

  async list(userId, filters, page, pageSize) {
    const params: unknown[] = [userId];
    const where = ['e.user_id = $1'];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace('?', `$${params.length}`));
    };
    if (filters.q) add("e.description ILIKE ? ESCAPE '\\'", `%${escapeLike(filters.q)}%`);
    if (filters.categoryId) add('e.category_id = ?', filters.categoryId);
    if (filters.from) add('e.spent_on >= ?', filters.from);
    if (filters.to) add('e.spent_on <= ?', filters.to);
    const whereSql = where.join(' AND ');

    const pool = getPool();
    const count = await pool.query<{ total: string }>(
      `SELECT count(*) AS total ${FROM} WHERE ${whereSql}`,
      params,
    );
    const { rows } = await pool.query<ExpenseView>(
      `SELECT ${VIEW_COLUMNS} ${FROM} WHERE ${whereSql}
       ORDER BY e.spent_on DESC, e.created_at DESC, e.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items: rows, page, pageSize, total: Number(count.rows[0].total) };
  },

  async get(userId, id) {
    const { rows } = await getPool().query<ExpenseView>(
      `SELECT ${VIEW_COLUMNS} ${FROM} WHERE e.id = $1 AND e.user_id = $2`,
      [id, userId],
    );
    return rows[0];
  },
};
