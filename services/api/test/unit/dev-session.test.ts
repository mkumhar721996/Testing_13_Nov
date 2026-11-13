import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import { devResolveUserId, devUserId } from '../../src/dev-session.js';
import type { Organization, OrganizationStore } from '../../src/stores/organizations.js';

const id = '11111111-1111-4111-8111-111111111111';
const row: Organization = {
  id,
  name: 'Locke Prep',
  address: null,
  adminName: null,
  adminEmail: null,
  createdBy: 'Daniel Gonzalez Bermudez',
  fcName: null,
  fcEmail: null,
  fcPhone: null,
};
const store: OrganizationStore = {
  get: async () => row,
  update: async (_id, input) => ({ ...row, ...input }),
};

describe('devResolveUserId', () => {
  it('is not provided in production, so the 401 guard stays on', () => {
    expect(devResolveUserId({ NODE_ENV: 'production' })).toBeUndefined();
  });

  it('signs in a fixed local user outside production', async () => {
    const resolve = devResolveUserId({ NODE_ENV: 'development' })!;
    expect(await resolve({} as never)).toBe(devUserId);
  });

  it('lets the organization screen load and save when the server is built with it', async () => {
    const app = buildApp({ organizations: store, resolveUserId: devResolveUserId({})! });
    const url = `/organizations/${id}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
    const put = await app.inject({ method: 'PUT', url, payload: { name: 'New name' } });
    expect(put.statusCode).toBe(200);
  });
});
