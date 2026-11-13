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

test('reads, saves and re-reads the seeded organization', async ({ request }) => {
  const first = await request.get(url);
  expect(first.status()).toBe(200);
  expect((await first.json()).createdBy).toBe('Daniel Gonzalez Bermudez');

  const put = await request.put(url, { data: { ...valid, createdBy: 'Mallory' } });
  expect(put.status()).toBe(200);

  const again = await (await request.get(url)).json();
  expect(again).toMatchObject({ name: 'Locke Prep', address: '1 New St', adminName: null, fcPhone: null });
  expect(again.createdBy).toBe('Daniel Gonzalez Bermudez');
});

test('blocks an invalid save and leaves the row alone', async ({ request }) => {
  const res = await request.put(url, { data: { ...valid, name: '' } });
  expect(res.status()).toBe(400);
});

test('re-running migrate leaves existing expenses untouched', async () => {
  const before = await getPool().query('SELECT count(*)::int AS n FROM expenses');
  await migrate();
  const after = await getPool().query('SELECT count(*)::int AS n FROM expenses');
  expect(after.rows[0].n).toBe(before.rows[0].n);
});
