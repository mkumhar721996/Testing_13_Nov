import { expect, test } from '@playwright/test';
import { getPool } from '../../src/db.js';
import { migrate } from '../../src/migrate.js';
import { seed, seededOrganizationId } from '../../src/seed.js';

// Needs a reachable PostgreSQL in DATABASE_URL (the API server started by playwright uses the same one).
const url = `/organizations/${seededOrganizationId}`;
const valid = { name: 'Locke Prep', address: '1 New St', adminName: '', adminEmail: '', fcName: '', fcEmail: '', fcPhone: '' };

test.beforeAll(async () => {
  await migrate();
  await migrate();
  await seed();
  await seed();
});

test.afterAll(async () => {
  await getPool().end();
});

// The server has no session resolver until the accounts story lands, so every caller is anonymous.
test('refuses to read the seeded organization without a session', async ({ request }) => {
  expect((await request.get(url)).status()).toBe(401);
});

test('refuses to save the seeded organization without a session and leaves the row alone', async ({ request }) => {
  const res = await request.put(url, { data: { ...valid, name: 'Hijacked' } });
  expect(res.status()).toBe(401);
  const row = await getPool().query('SELECT name FROM organizations WHERE id = $1', [seededOrganizationId]);
  expect(row.rows[0].name).not.toBe('Hijacked');
});

test('re-running migrate leaves existing expenses untouched', async () => {
  const before = await getPool().query('SELECT count(*)::int AS n FROM expenses');
  await migrate();
  const after = await getPool().query('SELECT count(*)::int AS n FROM expenses');
  expect(after.rows[0].n).toBe(before.rows[0].n);
});
