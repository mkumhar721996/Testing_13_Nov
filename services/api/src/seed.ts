import { getPool } from './db.js';

export const seededOrganizationId = '00000000-0000-4000-8000-000000000001';

/** Inserts the one organization the screen shows. Safe to re-run. */
export async function seed(): Promise<void> {
  await getPool().query(
    `INSERT INTO organizations (id, name, address, admin_name, admin_email, created_by, fc_name, fc_email, fc_phone)
     VALUES ($1, 'Alain Leroy Locke College Prep Academy', '325 E 111th St, Los Angeles CA 90061',
             'Karishmah', 'karishmah@gmail.com', 'Daniel Gonzalez Bermudez',
             'Morgan Gould', 'mgould@wfchocolate.com', '+15552184400')
     ON CONFLICT (id) DO NOTHING`,
    [seededOrganizationId],
  );
}

if (process.argv[1] === import.meta.filename) {
  seed()
    .then(() => getPool().end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
