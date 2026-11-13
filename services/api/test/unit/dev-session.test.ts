import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import { devResolveUserId, devUserId, serverSession } from '../../src/dev-session.js';
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
  it.each([{}, { NODE_ENV: 'development' }, { NODE_ENV: 'staging' }, { ALLOW_DEV_SESSION: 'true' }, { ALLOW_DEV_SESSION: '0' }])(
    'is off unless explicitly opted in (%j)',
    (env) => {
      expect(devResolveUserId(env)).toBeUndefined();
    },
  );

  it('is off in production even when opted in', () => {
    expect(devResolveUserId({ NODE_ENV: 'production', ALLOW_DEV_SESSION: '1' })).toBeUndefined();
  });

  it('signs in a fixed local user on explicit opt-in', async () => {
    const resolve = devResolveUserId({ ALLOW_DEV_SESSION: '1' })!;
    expect(await resolve({} as never)).toBe(devUserId);
  });

  it('serverSession binds to loopback with the dev session, and refuses to start without it', () => {
    expect(serverSession({ ALLOW_DEV_SESSION: '1', HOST: '0.0.0.0' }).host).toBe('127.0.0.1');
    expect(() => serverSession({})).toThrow(/No session resolver/);
    expect(() => serverSession({ NODE_ENV: 'production', ALLOW_DEV_SESSION: '1' })).toThrow(/No session resolver/);
  });

  it('lets the organization screen load and save when the server is built with it', async () => {
    const app = buildApp({ organizations: store, resolveUserId: devResolveUserId({ ALLOW_DEV_SESSION: '1' })! });
    const url = `/organizations/${id}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
    const put = await app.inject({ method: 'PUT', url, payload: { name: 'New name' } });
    expect(put.statusCode).toBe(200);
  });
});
