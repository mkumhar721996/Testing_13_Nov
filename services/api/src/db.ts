import pg from 'pg';

let pool: pg.Pool | undefined;

/** Lazily creates the PostgreSQL pool from DATABASE_URL. */
export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
