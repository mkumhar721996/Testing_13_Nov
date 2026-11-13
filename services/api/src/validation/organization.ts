export type OrganizationInput = {
  name: string;
  address: string | null;
  adminName: string | null;
  adminEmail: string | null;
  fcName: string | null;
  fcEmail: string | null;
  fcPhone: string | null;
};

export type OrganizationErrors = Partial<Record<keyof OrganizationInput, string>>;

export type OrganizationValidation =
  | { ok: true; value: OrganizationInput }
  | { ok: false; errors: OrganizationErrors };

// One @, text on both sides, and a dot in the domain.
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const PHONE = /^\+?\d{7,15}$/;
const EMAIL_MESSAGE = 'Enter an email like name@example.com.';
const PHONE_MESSAGE = 'Enter 7 to 15 digits, with an optional + at the start.';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Validates an organization body. Any other key (e.g. createdBy) is ignored. */
export function validateOrganizationInput(body: unknown): OrganizationValidation {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: OrganizationErrors = {};
  const name = text(b.name);
  const adminEmail = text(b.adminEmail);
  const fcEmail = text(b.fcEmail);
  const fcPhone = text(b.fcPhone);

  if (!name) errors.name = 'Enter the organization name.';
  if (adminEmail && !EMAIL.test(adminEmail)) errors.adminEmail = EMAIL_MESSAGE;
  if (fcEmail && !EMAIL.test(fcEmail)) errors.fcEmail = EMAIL_MESSAGE;
  if (fcPhone && !PHONE.test(fcPhone)) errors.fcPhone = PHONE_MESSAGE;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      address: text(b.address) || null,
      adminName: text(b.adminName) || null,
      adminEmail: adminEmail || null,
      fcName: text(b.fcName) || null,
      fcEmail: fcEmail || null,
      fcPhone: fcPhone || null,
    },
  };
}
