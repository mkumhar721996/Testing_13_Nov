import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizationPage from './OrganizationPage'
import * as api from './api'

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getOrganization: vi.fn(),
  saveOrganization: vi.fn(),
}))

const org: api.Organization = {
  id: 'org-1',
  name: 'Locke Prep',
  address: '325 E 111th St',
  adminName: 'Karishmah',
  adminEmail: 'karishmah@gmail.com',
  createdBy: 'Daniel Gonzalez',
  fcName: 'Morgan Gould',
  fcEmail: 'mgould@example.com',
  fcPhone: '+15552184400',
}
const blankOptionals = { address: '', adminName: '', adminEmail: '', fcName: '', fcEmail: '', fcPhone: '' }

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const click = (el: HTMLElement) => fireEvent.click(el)
const field = (label: RegExp) => screen.getByLabelText(label)
const saveButton = () => screen.getByRole('button', { name: 'Save changes' })

async function openEdit() {
  render(<OrganizationPage organizationId="org-1" />)
  click(await screen.findByRole('button', { name: 'Edit' }))
}

beforeEach(() => {
  vi.mocked(api.getOrganization).mockReset().mockResolvedValue(org)
  vi.mocked(api.saveOrganization).mockReset().mockImplementation(async (_id, v) => ({ ...org, ...v }))
})

describe('OrganizationPage read view', () => {
  it('shows every detail (AC 1)', async () => {
    render(<OrganizationPage organizationId="org-1" />)
    expect(await screen.findByRole('heading', { level: 2, name: org.name })).toBeInTheDocument()
    for (const text of [org.address, org.adminName, org.adminEmail, org.createdBy, org.fcName, org.fcEmail, org.fcPhone]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(api.getOrganization).toHaveBeenCalledWith('org-1')
  })

  it('shows exactly one organization and no list (AC 2)', async () => {
    render(<OrganizationPage organizationId="org-1" />)
    await screen.findByRole('heading', { level: 2 })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows Not provided and No FC contact added for blank values (AC 9, 10)', async () => {
    vi.mocked(api.getOrganization).mockResolvedValue({ ...org, ...blankOptionals })
    render(<OrganizationPage organizationId="org-1" />)
    await screen.findByRole('heading', { level: 2 })
    expect(screen.getAllByText('Not provided')).toHaveLength(2)
    expect(screen.getByText('No FC contact added')).toBeInTheDocument()
  })

  it('shows a loading status while fetching', () => {
    vi.mocked(api.getOrganization).mockReturnValue(new Promise(() => {}))
    render(<OrganizationPage organizationId="org-1" />)
    expect(screen.getByRole('status', { name: 'Loading organization' })).toHaveAttribute('aria-busy', 'true')
  })

  it('shows a load error and Try again refetches', async () => {
    vi.mocked(api.getOrganization).mockRejectedValueOnce(new Error('404'))
    render(<OrganizationPage organizationId="org-1" />)
    expect(await screen.findByText(/We couldn't load this organization/)).toBeInTheDocument()
    click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 2, name: org.name })).toBeInTheDocument()
    expect(api.getOrganization).toHaveBeenCalledTimes(2)
  })
})

describe('OrganizationPage edit form', () => {
  it('shows created by as plain text with no field (AC 4)', async () => {
    await openEdit()
    expect(screen.getByText(org.createdBy)).toBeInTheDocument()
    expect(screen.queryByLabelText(/created by/i)).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(org.createdBy)).not.toBeInTheDocument()
  })

  it('saves a changed value and shows it in the read view (AC 3)', async () => {
    await openEdit()
    type(field(/^address/i), '1 New St')
    click(saveButton())
    expect(await screen.findByText('1 New St')).toBeInTheDocument()
    expect(api.saveOrganization).toHaveBeenCalledWith('org-1', expect.objectContaining({ address: '1 New St' }))
    expect(screen.getByText(/Organization saved\. The details below/)).toBeInTheDocument()
    expect(screen.getByText('Organization saved')).toBeInTheDocument()
  })

  it('does not send createdBy', async () => {
    await openEdit()
    click(saveButton())
    await screen.findByText(/Organization saved\./)
    expect(vi.mocked(api.saveOrganization).mock.calls[0][1]).not.toHaveProperty('createdBy')
  })

  it('blocks a blank name without calling the API (AC 5)', async () => {
    await openEdit()
    type(field(/organization name/i), '')
    click(saveButton())
    expect(screen.getByText('Enter the organization name.')).toBeInTheDocument()
    expect(api.saveOrganization).not.toHaveBeenCalled()
  })

  it.each([
    [/admin email/i, 'a@b', 'Enter an email like name@example.com.'],
    [/contact email/i, 'a@@b.com', 'Enter an email like name@example.com.'],
    [/contact phone/i, '123456', 'Enter 7 to 15 digits, with an optional + at the start.'],
    [/contact phone/i, '1234567890123456', 'Enter 7 to 15 digits, with an optional + at the start.'],
  ])('blocks a bad value %s = %s (AC 6, 11, 12)', async (label, value, message) => {
    await openEdit()
    type(field(label), value)
    click(saveButton())
    expect(field(label)).toHaveAccessibleDescription(expect.stringContaining(message))
    expect(field(label)).toHaveAttribute('aria-invalid', 'true')
    expect(api.saveOrganization).not.toHaveBeenCalled()
  })

  it('shows a message beside each bad field and keeps every typed value (AC 7, 8)', async () => {
    await openEdit()
    type(field(/organization name/i), '')
    type(field(/^address/i), 'typed address')
    type(field(/admin name/i), 'typed admin')
    type(field(/admin email/i), 'karishmah@gmail')
    type(field(/contact name/i), 'typed fc')
    type(field(/contact email/i), 'fc@example.com')
    type(field(/contact phone/i), '123456')
    click(saveButton())

    expect(screen.getByRole('alert')).toHaveTextContent('Not saved. Fix 3 fields below. What you typed is still in the form.')
    expect(field(/admin email/i)).toHaveAccessibleDescription('Enter an email like name@example.com.')
    expect(field(/organization name/i)).toHaveFocus()
    expect(field(/^address/i)).toHaveValue('typed address')
    expect(field(/admin name/i)).toHaveValue('typed admin')
    expect(field(/admin email/i)).toHaveValue('karishmah@gmail')
    expect(field(/contact name/i)).toHaveValue('typed fc')
    expect(field(/contact email/i)).toHaveValue('fc@example.com')
    expect(field(/contact phone/i)).toHaveValue('123456')
  })

  it('keeps typed values when the API answers 400 (AC 7, 8)', async () => {
    vi.mocked(api.saveOrganization).mockRejectedValue(
      new api.OrganizationRejectedError({ adminEmail: 'Enter an email like name@example.com.' }),
    )
    await openEdit()
    type(field(/^address/i), 'typed address')
    click(saveButton())
    await waitFor(() => expect(field(/admin email/i)).toHaveAttribute('aria-invalid', 'true'))
    expect(field(/^address/i)).toHaveValue('typed address')
    expect(screen.getByText('Enter an email like name@example.com.')).toBeInTheDocument()
  })

  it('keeps the form and shows an error when the save fails', async () => {
    vi.mocked(api.saveOrganization).mockRejectedValue(new Error('500'))
    await openEdit()
    type(field(/^address/i), 'typed address')
    click(saveButton())
    expect(await screen.findByText("We couldn't save the organization. Try again.")).toBeInTheDocument()
    expect(field(/^address/i)).toHaveValue('typed address')
  })

  it('saves with the FC contact blank (AC 9)', async () => {
    await openEdit()
    for (const label of [/contact name/i, /contact email/i, /contact phone/i]) type(field(label), '')
    click(saveButton())
    expect(await screen.findByText('No FC contact added')).toBeInTheDocument()
  })

  it('saves with address, admin name and admin email blank (AC 10)', async () => {
    await openEdit()
    for (const label of [/^address/i, /admin name/i, /admin email/i]) type(field(label), '')
    click(saveButton())
    expect(await screen.findAllByText('Not provided')).toHaveLength(2)
  })

  it('Cancel returns to the read view and discards edits', async () => {
    await openEdit()
    type(field(/^address/i), 'discard me')
    click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(org.address)).toBeInTheDocument()
    expect(screen.queryByText('discard me')).not.toBeInTheDocument()
    expect(api.saveOrganization).not.toHaveBeenCalled()
  })
})
