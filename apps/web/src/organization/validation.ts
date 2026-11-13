export type OrganizationValues = {
  name: string
  address: string
  adminName: string
  adminEmail: string
  fcName: string
  fcEmail: string
  fcPhone: string
}

export type OrganizationErrors = Partial<Record<keyof OrganizationValues, string>>

// One @, text on both sides, and a dot in the domain.
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/
const PHONE = /^\+?\d{7,15}$/
const EMAIL_MESSAGE = 'Enter an email like name@example.com.'
const PHONE_MESSAGE = 'Enter 7 to 15 digits, with an optional + at the start.'

/** Mirrors the API rules for fast feedback; the API stays the authority. */
export function validateOrganizationForm(values: OrganizationValues): OrganizationErrors {
  const errors: OrganizationErrors = {}
  const adminEmail = values.adminEmail.trim()
  const fcEmail = values.fcEmail.trim()
  const fcPhone = values.fcPhone.trim()

  if (!values.name.trim()) errors.name = 'Enter the organization name.'
  if (adminEmail && !EMAIL.test(adminEmail)) errors.adminEmail = EMAIL_MESSAGE
  if (fcEmail && !EMAIL.test(fcEmail)) errors.fcEmail = EMAIL_MESSAGE
  if (fcPhone && !PHONE.test(fcPhone)) errors.fcPhone = PHONE_MESSAGE
  return errors
}
