import { describe, it, expect } from 'vitest';
import { validateOrganizationInput } from '../../src/validation/organization.js';

const valid = {
  name: 'Locke Prep',
  address: '325 E 111th St',
  adminName: 'Karishmah',
  adminEmail: 'karishmah@gmail.com',
  fcName: 'Morgan Gould',
  fcEmail: 'mgould@example.com',
  fcPhone: '+15552184400',
};
const EMAIL_MSG = 'Enter an email like name@example.com.';
const PHONE_MSG = 'Enter 7 to 15 digits, with an optional + at the start.';
const badEmails = ['a', 'a@', '@b.com', 'a@b', 'a@@b.com', 'a@b@c.com'];
const badPhones = ['12345', '123-456-7890', '+', 'abc1234567', '123456', '1234567890123456'];

describe('validateOrganizationInput', () => {
  it('accepts a fully valid body', () => {
    expect(validateOrganizationInput(valid)).toEqual({ ok: true, value: valid });
  });

  it('blocks a blank name (AC 5)', () => {
    expect(validateOrganizationInput({ ...valid, name: '   ' })).toEqual({
      ok: false,
      errors: { name: 'Enter the organization name.' },
    });
  });

  it.each(badEmails)('rejects admin email %s (AC 6)', (adminEmail) => {
    expect(validateOrganizationInput({ ...valid, adminEmail })).toEqual({ ok: false, errors: { adminEmail: EMAIL_MSG } });
  });

  it.each(badEmails)('rejects FC email %s (AC 6)', (fcEmail) => {
    expect(validateOrganizationInput({ ...valid, fcEmail })).toEqual({ ok: false, errors: { fcEmail: EMAIL_MSG } });
  });

  it.each(badPhones)('rejects FC phone %s (AC 6, 11, 12)', (fcPhone) => {
    expect(validateOrganizationInput({ ...valid, fcPhone })).toEqual({ ok: false, errors: { fcPhone: PHONE_MSG } });
  });

  it('accepts phone boundaries of 7 and 15 digits, with or without + (AC 11, 12)', () => {
    for (const fcPhone of ['1234567', '123456789012345', '+123456789012345', '+1234567']) {
      expect(validateOrganizationInput({ ...valid, fcPhone }).ok).toBe(true);
    }
  });

  it('accepts a valid minimal email', () => {
    expect(validateOrganizationInput({ ...valid, adminEmail: 'a@b.co', fcEmail: 'a@b.co' }).ok).toBe(true);
  });

  it('turns blank optional values into null (AC 9, 10)', () => {
    const r = validateOrganizationInput({ name: 'X', address: '', adminName: ' ', adminEmail: '', fcName: '', fcEmail: '', fcPhone: '' });
    expect(r).toEqual({
      ok: true,
      value: { name: 'X', address: null, adminName: null, adminEmail: null, fcName: null, fcEmail: null, fcPhone: null },
    });
  });

  it('reports every bad field at once (AC 7) and ignores createdBy', () => {
    const r = validateOrganizationInput({ ...valid, name: '', adminEmail: 'x', fcPhone: '1', createdBy: 'Mallory' });
    expect(r).toEqual({ ok: false, errors: { name: 'Enter the organization name.', adminEmail: EMAIL_MSG, fcPhone: PHONE_MSG } });
    expect(validateOrganizationInput({ ...valid, createdBy: 'Mallory' })).toEqual({ ok: true, value: valid });
  });

  it('treats non-string values as blank', () => {
    expect(validateOrganizationInput({ ...valid, name: 5 })).toMatchObject({ ok: false });
    expect(validateOrganizationInput(null)).toMatchObject({ ok: false });
  });
});
