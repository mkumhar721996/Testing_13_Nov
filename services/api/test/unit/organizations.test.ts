import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Organization, OrganizationStore } from '../../src/stores/organizations.js';
import type { OrganizationInput } from '../../src/validation/organization.js';

const id = '11111111-1111-4111-8111-111111111111';
const missingId = '22222222-2222-4222-8222-222222222222';

class FakeOrganizations implements OrganizationStore {
  updated: OrganizationInput[] = [];
  row: Organization = {
    id,
    name: 'Locke Prep',
    address: '325 E 111th St',
    adminName: 'Karishmah',
    adminEmail: 'karishmah@gmail.com',
    createdBy: 'Daniel Gonzalez Bermudez',
    fcName: 'Morgan Gould',
    fcEmail: 'mgould@example.com',
    fcPhone: '+15552184400',
  };
  async get(wanted: string) {
    return wanted === id ? this.row : undefined;
  }
  async update(wanted: string, input: OrganizationInput) {
    if (wanted !== id) return undefined;
    this.updated.push(input);
    this.row = { ...this.row, ...input };
    return this.row;
  }
}

const valid = {
  name: 'Locke Prep',
  address: '325 E 111th St',
  adminName: 'Karishmah',
  adminEmail: 'karishmah@gmail.com',
  fcName: 'Morgan Gould',
  fcEmail: 'mgould@example.com',
  fcPhone: '+15552184400',
};

describe('organizations API', () => {
  let store: FakeOrganizations;
  let app: ReturnType<typeof buildApp>;
  const url = `/organizations/${id}`;
  const put = (payload: object) => app.inject({ method: 'PUT', url, payload });

  beforeEach(() => {
    store = new FakeOrganizations();
    app = buildApp({ organizations: store });
  });

  it('returns every detail of one organization (AC 1)', async () => {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ...valid, createdBy: 'Daniel Gonzalez Bermudez' });
  });

  it('404s for a missing or malformed id', async () => {
    expect((await app.inject({ method: 'GET', url: `/organizations/${missingId}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/organizations/not-a-uuid' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/organizations/not-a-uuid', payload: valid })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: `/organizations/${missingId}`, payload: valid })).statusCode).toBe(404);
  });

  it('has no list route (AC 2)', async () => {
    expect((await app.inject({ method: 'GET', url: '/organizations' })).statusCode).toBe(404);
  });

  it.each(Object.keys(valid))('saves a changed %s and returns it on the next GET (AC 3)', async (field) => {
    const changed = field === 'adminEmail' || field === 'fcEmail' ? 'new@example.org' : field === 'fcPhone' ? '1234567' : 'New value';
    const res = await put({ ...valid, [field]: changed });
    expect(res.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url })).json()[field]).toBe(changed);
  });

  it('ignores createdBy from the client (AC 4)', async () => {
    const res = await put({ ...valid, createdBy: 'Mallory' });
    expect(res.statusCode).toBe(200);
    expect(res.json().createdBy).toBe('Daniel Gonzalez Bermudez');
  });

  it('blocks a blank name and never calls the store (AC 5)', async () => {
    const res = await put({ ...valid, name: '' });
    expect(res.statusCode).toBe(400);
    expect(store.updated).toHaveLength(0);
  });

  it.each([
    ['adminEmail', 'a@b'],
    ['fcEmail', 'a@@b.com'],
    ['fcPhone', '123456'],
    ['fcPhone', '1234567890123456'],
  ])('blocks a bad %s (%s) (AC 6, 11, 12)', async (field, value) => {
    const res = await put({ ...valid, [field]: value });
    expect(res.statusCode).toBe(400);
    expect(store.updated).toHaveLength(0);
  });

  it('names every bad field in the 400 body (AC 7)', async () => {
    const res = await put({ ...valid, name: '', adminEmail: 'x', fcPhone: '1' });
    expect(res.json().errors).toEqual({
      name: 'Enter the organization name.',
      adminEmail: 'Enter an email like name@example.com.',
      fcPhone: 'Enter 7 to 15 digits, with an optional + at the start.',
    });
  });

  it('saves with the FC contact blank (AC 9)', async () => {
    const res = await put({ ...valid, fcName: '', fcEmail: '', fcPhone: '' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ fcName: null, fcEmail: null, fcPhone: null });
  });

  it('saves with address, admin name and admin email blank (AC 10)', async () => {
    const res = await put({ ...valid, address: '', adminName: '', adminEmail: '' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ address: null, adminName: null, adminEmail: null });
  });
});
