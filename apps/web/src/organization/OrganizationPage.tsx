import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { getOrganization, OrganizationRejectedError, saveOrganization, type Organization } from './api'
import { validateOrganizationForm, type OrganizationErrors, type OrganizationValues } from './validation'
import './organization.css'

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; organization: Organization }
type Mode = 'read' | 'edit'
type Save = 'idle' | 'saving' | 'saved' | 'failed'

const toValues = (o: Organization): OrganizationValues => ({
  name: o.name,
  address: o.address,
  adminName: o.adminName,
  adminEmail: o.adminEmail,
  fcName: o.fcName,
  fcEmail: o.fcEmail,
  fcPhone: o.fcPhone,
})

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="detail-label">{label}</p>
      <p className={`detail-value${value ? '' : ' text-muted'}`}>{value || 'Not provided'}</p>
    </div>
  )
}

function ReadView({ organization: o, onEdit }: { organization: Organization; onEdit: () => void }) {
  const hasAdmin = Boolean(o.adminName || o.adminEmail)
  const hasFc = Boolean(o.fcName || o.fcEmail || o.fcPhone)
  return (
    <div className="stack">
      <div>
        <p className="detail-label">Organization</p>
        <h2 className="detail-title">{o.name}</h2>
      </div>
      <Detail label="Address" value={o.address} />
      <div>
        <p className="detail-label">Admin</p>
        {hasAdmin ? (
          <div className="row-wrap">
            {o.adminName && <span className="detail-value">{o.adminName}</span>}
            {o.adminEmail && <span className="detail-value">{o.adminEmail}</span>}
          </div>
        ) : (
          <p className="detail-value text-muted">Not provided</p>
        )}
      </div>
      <Detail label="Created by" value={o.createdBy} />
      <div className="fc-box">
        <p className="detail-label">FC contact</p>
        {hasFc ? (
          <>
            {o.fcName && <strong className="detail-value">{o.fcName}</strong>}
            <div className="row-wrap">
              {o.fcEmail && <span className="detail-value">{o.fcEmail}</span>}
              {o.fcPhone && <span className="detail-value">{o.fcPhone}</span>}
            </div>
          </>
        ) : (
          <p className="detail-value text-muted">No FC contact added</p>
        )}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  )
}

type EditFormProps = {
  organization: Organization
  onSaved: (organization: Organization) => void
  onCancel: () => void
}

function EditForm({ organization, onSaved, onCancel }: EditFormProps) {
  const [values, setValues] = useState(() => toValues(organization))
  const [errors, setErrors] = useState<OrganizationErrors>({})
  const [save, setSave] = useState<Save>('idle')
  const [focusTick, setFocusTick] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (focusTick > 0) formRef.current?.querySelector<HTMLInputElement>('.is-invalid')?.focus()
  }, [focusTick])

  const set = (key: keyof OrganizationValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  function block(found: OrganizationErrors) {
    setErrors(found)
    setSave('idle')
    setFocusTick((n) => n + 1)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateOrganizationForm(values)
    if (Object.keys(found).length > 0) return block(found)
    setErrors({})
    setSave('saving')
    try {
      onSaved(await saveOrganization(organization.id, values))
    } catch (err) {
      if (err instanceof OrganizationRejectedError) block(err.errors)
      else setSave('failed')
    }
  }

  const count = Object.keys(errors).length

  function renderField(key: keyof OrganizationValues, label: string, opts: { required?: boolean; hint?: string } = {}) {
    const id = `org-${key}`
    const describedBy = [opts.hint && `${id}-hint`, errors[key] && `${id}-error`].filter(Boolean).join(' ')
    return (
      <div className="field">
        <label htmlFor={id}>
          {label} <span className="req">{opts.required ? '(required)' : '(optional)'}</span>
        </label>
        <input
          className={`input${errors[key] ? ' is-invalid' : ''}`}
          id={id}
          name={key}
          value={values[key]}
          onChange={set(key)}
          aria-required={opts.required || undefined}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {opts.hint && (
          <span className="field-hint" id={`${id}-hint`}>
            {opts.hint}
          </span>
        )}
        {errors[key] && (
          <span className="field-error" id={`${id}-error`}>
            {errors[key]}
          </span>
        )}
      </div>
    )
  }

  return (
    <form className="stack" noValidate ref={formRef} onSubmit={onSubmit} aria-label="Edit organization">
      {count > 0 && (
        <div className="alert alert-danger" role="alert">
          <span>
            Not saved. Fix {count} {count === 1 ? 'field' : 'fields'} below. What you typed is still in the form.
          </span>
        </div>
      )}
      {save === 'failed' && (
        <div className="alert alert-danger" role="alert">
          <span>We couldn't save the organization. Try again.</span>
        </div>
      )}
      <div className="form-grid">
        {renderField('name', 'Organization name', { required: true })}
        {renderField('address', 'Address')}
        {renderField('adminName', 'Admin name')}
        {renderField('adminEmail', 'Admin email')}
        <div className="field">
          <span className="field-label">Created by</span>
          <span className="readonly-value">{organization.createdBy}</span>
          <span className="field-hint">Recorded by the system when the organization was created. It can't be changed.</span>
        </div>
        <fieldset className="fc-group">
          <legend>FC contact (optional)</legend>
          <div className="form-grid">
            {renderField('fcName', 'Contact name')}
            {renderField('fcEmail', 'Contact email')}
            {renderField('fcPhone', 'Contact phone', { hint: '7 to 15 digits, optional + at the start. No spaces.' })}
          </div>
        </fieldset>
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={save === 'saving'}>
          {save === 'saving' ? (
            <>
              <span className="spinner" aria-hidden="true" /> Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function OrganizationPage({ organizationId }: { organizationId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [mode, setMode] = useState<Mode>('read')
  const [justSaved, setJustSaved] = useState(false)

  const fetchOrganization = useCallback(() => {
    setLoad({ state: 'loading' })
    getOrganization(organizationId).then(
      (organization) => setLoad({ state: 'ready', organization }),
      () => setLoad({ state: 'failed' }),
    )
  }, [organizationId])

  useEffect(fetchOrganization, [fetchOrganization])

  return (
    <div className="container">
      <div className="page-head">
        <h1>Organization</h1>
      </div>
      <div className="card stack org-card">
        {load.state === 'loading' && (
          <div className="stack" role="status" aria-busy="true" aria-label="Loading organization">
            {[60, 85, 45, 70, 100].map((width) => (
              <span key={width} className="skeleton skeleton-line" style={{ width: `${width}%` }} />
            ))}
          </div>
        )}
        {load.state === 'failed' && (
          <div className="stack">
            <div className="alert alert-danger" role="alert">
              <span>We couldn't load this organization. Check your connection and try again.</span>
            </div>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={fetchOrganization}>
                Try again
              </button>
            </div>
          </div>
        )}
        {load.state === 'ready' && mode === 'read' && (
          <>
            {justSaved && (
              <div className="alert alert-success" role="status">
                <span>Organization saved. The details below are the saved values.</span>
              </div>
            )}
            <ReadView
              organization={load.organization}
              onEdit={() => {
                setJustSaved(false)
                setMode('edit')
              }}
            />
          </>
        )}
        {load.state === 'ready' && mode === 'edit' && (
          <EditForm
            organization={load.organization}
            onCancel={() => setMode('read')}
            onSaved={(organization) => {
              setLoad({ state: 'ready', organization })
              setJustSaved(true)
              setMode('read')
            }}
          />
        )}
      </div>
      {justSaved && mode === 'read' && (
        <div className="toast" role="status">
          <span>Organization saved</span>
        </div>
      )}
    </div>
  )
}
