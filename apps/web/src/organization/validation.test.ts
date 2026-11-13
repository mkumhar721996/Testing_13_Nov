import { validateOrganizationForm } from './validation'

const valid = {
  name: 'Locke Prep',
  address: '325 E 111th St',
  adminName: 'Karishmah',
  adminEmail: 'karishmah@gmail.com',
  fcName: 'Morgan Gould',
  fcEmail: 'mgould@example.com',
  fcPhone: '+15552184400',
}
const EMAIL_MSG = 'Enter an email like name@example.com.'
const PHONE_MSG = 'Enter 7 to 15 digits, with an optional + at the start.'
const badEmails = ['a', 'a@', '@b.com', 'a@b', 'a@@b.com', 'a@b@c.com']
const badPhones = ['12345', '123-456-7890', '+', 'abc1234567', '123456', '1234567890123456']

describe('validateOrganizationForm', () => {
  it('accepts valid values', () => {
    expect(validateOrganizationForm(valid)).toEqual({})
  })

  it('blocks a blank name', () => {
    expect(validateOrganizationForm({ ...valid, name: '  ' })).toEqual({ name: 'Enter the organization name.' })
  })

  it.each(badEmails)('rejects admin email %s', (adminEmail) => {
    expect(validateOrganizationForm({ ...valid, adminEmail })).toEqual({ adminEmail: EMAIL_MSG })
  })

  it.each(badEmails)('rejects FC email %s', (fcEmail) => {
    expect(validateOrganizationForm({ ...valid, fcEmail })).toEqual({ fcEmail: EMAIL_MSG })
  })

  it.each(badPhones)('rejects FC phone %s', (fcPhone) => {
    expect(validateOrganizationForm({ ...valid, fcPhone })).toEqual({ fcPhone: PHONE_MSG })
  })

  it.each(['1234567', '123456789012345', '+123456789012345'])('accepts FC phone %s', (fcPhone) => {
    expect(validateOrganizationForm({ ...valid, fcPhone })).toEqual({})
  })

  it('allows all optional values to be blank', () => {
    const blank = { ...valid, address: '', adminName: '', adminEmail: '', fcName: '', fcEmail: '', fcPhone: '' }
    expect(validateOrganizationForm(blank)).toEqual({})
  })
})
