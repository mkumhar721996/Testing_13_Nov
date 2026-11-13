import { getPool } from '../db.js';

export type NewExpense = {
  amount: string;
  date: string;
  categoryId: string;
  description: string | null;
};

export type Expense = NewExpense & { id: string; userId: string };

export interface ExpenseStore {
  create(userId: string, input: NewExpense): Promise<Expense>;
}

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
};
