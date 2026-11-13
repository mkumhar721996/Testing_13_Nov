import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPool } from './db.js';

const dir = join(import.meta.dirname, '..', 'migrations');

/** Applies every migrations/*.sql file in name order. Files are written to be re-runnable. */
export async function migrate(): Promise<void> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await getPool().query(await readFile(join(dir, file), 'utf8'));
  }
}

if (process.argv[1] === import.meta.filename) {
  migrate()
    .then(() => getPool().end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
