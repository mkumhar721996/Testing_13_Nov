import { getPool } from '../db.js';

export type Category = { id: string; name: string };

export interface CategoryStore {
  listForUser(userId: string): Promise<Category[]>;
  existsForUser(userId: string, categoryId: string): Promise<boolean>;
}

export const pgCategoryStore: CategoryStore = {
  async listForUser(userId) {
    const { rows } = await getPool().query<Category>(
      'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name',
      [userId],
    );
    return rows;
  },
  async existsForUser(userId, categoryId) {
    const { rowCount } = await getPool().query(
      'SELECT 1 FROM categories WHERE user_id = $1 AND id = $2',
      [userId, categoryId],
    );
    return (rowCount ?? 0) > 0;
  },
};
