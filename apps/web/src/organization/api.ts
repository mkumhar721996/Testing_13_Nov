import type { OrganizationErrors, OrganizationValues } from './validation'

export type Organization = OrganizationValues & { id: string; createdBy: string }

/** The API rejected the organization; `errors` are per-field messages. */
export class OrganizationRejectedError extends Error {
  constructor(readonly errors: OrganizationErrors) {
    super('Organization rejected')
  }
}

// The API returns null for blank optional values; the form works with ''.
function fromApi(body: Record<string, string | null>): Organization {
  const text = (key: string) => body[key] ?? ''
  return {
    id: text('id'),
    name: text('name'),
    address: text('address'),
    adminName: text('adminName'),
    adminEmail: text('adminEmail'),
    createdBy: text('createdBy'),
    fcName: text('fcName'),
    fcEmail: text('fcEmail'),
    fcPhone: text('fcPhone'),
  }
}

export async function getOrganization(id: string): Promise<Organization> {
  const res = await fetch(`/organizations/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('Could not load organization')
  return fromApi(await res.json())
}

export async function saveOrganization(id: string, values: OrganizationValues): Promise<Organization> {
  const res = await fetch(`/organizations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values),
  })
  if (res.status === 400) throw new OrganizationRejectedError((await res.json()).errors ?? {})
  if (!res.ok) throw new Error('Could not save organization')
  return fromApi(await res.json())
}
