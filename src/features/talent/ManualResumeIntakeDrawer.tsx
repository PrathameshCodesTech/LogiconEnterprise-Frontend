import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { manualResumeIntake } from '@/api/talent'
import { parseApiError } from '@/lib/apiError'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import type { ManualResumeIntakeResponse } from '@/features/talent/types'

function TextArea({
  id,
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  rows: number
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-app-secondary">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[3rem] w-full resize-y rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
    </div>
  )
}

export function ManualResumeIntakeDrawer({
  open,
  onClose,
  defaultMrfId,
  defaultMrfLineItemId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  defaultMrfId?: number | null
  defaultMrfLineItemId?: number | null
  onSuccess?: (res: ManualResumeIntakeResponse) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ManualResumeIntakeResponse | null>(null)

  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentRole, setCurrentRole] = useState('')
  const [currentLocation, setCurrentLocation] = useState('')
  const [totalExp, setTotalExp] = useState('')
  const [skills, setSkills] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const reset = useCallback(() => {
    setError(null)
    setDone(null)
    setFirstName('')
    setMiddleName('')
    setLastName('')
    setPhone('')
    setEmail('')
    setCurrentRole('')
    setCurrentLocation('')
    setTotalExp('')
    setSkills('')
    setFile(null)
  }, [])

  useEffect(() => {
    if (!open) return
    reset()
    setCurrentRole('Housekeeping Associate')
    setCurrentLocation('Mumbai')
    setTotalExp('2')
    setSkills('housekeeping, cleaning, floor care')
  }, [open, reset])

  const linkedToDemand =
    defaultMrfLineItemId != null && defaultMrfLineItemId > 0

  async function submit() {
    setBusy(true)
    setError(null)
    setDone(null)
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('First name, last name, and phone are required.')
      setBusy(false)
      return
    }
    if (!file) {
      setError('Please attach a resume file.')
      setBusy(false)
      return
    }
    const fd = new FormData()
    fd.append('first_name', firstName.trim())
    fd.append('middle_name', middleName.trim())
    fd.append('last_name', lastName.trim())
    fd.append('phone', phone.trim())
    fd.append('email', email.trim())
    fd.append('current_role', currentRole.trim())
    fd.append('current_location', currentLocation.trim())
    if (totalExp.trim()) fd.append('total_experience_years', totalExp.trim())
    fd.append('skills', skills.trim())
    fd.append('resume_file', file)
    if (defaultMrfId != null && defaultMrfId > 0) fd.append('mrf', String(defaultMrfId))
    if (defaultMrfLineItemId != null && defaultMrfLineItemId > 0) fd.append('mrf_line_item', String(defaultMrfLineItemId))

    try {
      const res = await manualResumeIntake(fd)
      setDone(res)
      onSuccess?.(res)
    } catch (e: unknown) {
      setError(parseApiError(e, 'Could not save candidate').message)
    } finally {
      setBusy(false)
    }
  }

  const drawerTitle = linkedToDemand ? 'Add candidate' : 'Add to resume pool'
  const drawerDescription = linkedToDemand
    ? 'Capture profile details and attach a resume. This creates the candidate and opens an application for this hiring demand.'
    : 'Upload a resume and tag the candidate so they can be found later for hiring demands.'

  return (
    <Drawer
      open={open}
      onClose={() => !busy && onClose()}
      title={drawerTitle}
      description={drawerDescription}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {done ? 'Close' : 'Cancel'}
          </Button>
          {!done ? (
            <Button type="button" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Saving...' : 'Submit'}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        {error ? <ErrorState message={error} /> : null}
        {done ? (
          <div className="rounded-panel border border-status-success/30 bg-status-success/5 p-3 text-sm text-app-text">
            <p className="font-medium text-status-success">
              {done.hiring_application ? 'Candidate saved.' : 'Candidate added to resume pool.'}
            </p>
            <p className="mt-2 text-app-secondary">
              <Link className="font-medium text-brand-700 underline" to={`/candidates/${done.candidate.id}`}>
                View candidate profile
              </Link>
            </p>
            {done.hiring_application ? (
              <p className="mt-2 text-app-secondary">
                <Link className="font-medium text-brand-700 underline" to={`/hiring-applications/${done.hiring_application.id}`}>
                  Open application
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input id="mri_fn" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input id="mri_mn" label="Middle name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              <Input id="mri_ln" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Input id="mri_phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input id="mri_email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              id="mri_role"
              label="Current role"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              placeholder="e.g. Housekeeping Associate"
            />
            <Input
              id="mri_loc"
              label="Current location"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g. Mumbai"
            />
            <Input
              id="mri_exp"
              label="Total experience (years)"
              value={totalExp}
              onChange={(e) => setTotalExp(e.target.value)}
              placeholder="e.g. 2"
            />
            <TextArea
              id="mri_skills"
              label="Skills (comma-separated)"
              rows={2}
              value={skills}
              onChange={setSkills}
              placeholder="housekeeping, cleaning, floor care"
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="mri_file" className="text-sm font-medium text-app-secondary">
                Resume file
              </label>
              <input
                id="mri_file"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="text-sm text-app-secondary file:mr-3 file:rounded-panel file:border file:border-app-border file:bg-app-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-app-text"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {defaultMrfLineItemId ? (
              <p className="text-xs text-app-subtle">
                This intake is linked to the selected hiring demand (MRF line #{defaultMrfLineItemId}).
              </p>
            ) : null}
          </>
        )}
      </div>
    </Drawer>
  )
}
