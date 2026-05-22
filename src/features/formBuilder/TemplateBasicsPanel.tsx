import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { updateFormTemplate } from '@/api/formBuilder'
import { parseApiError } from '@/lib/apiError'
import { validateSlug } from '@/features/formBuilder/slug'
import type { FormTemplateRow } from '@/features/formBuilder/types'

export function TemplateBasicsPanel({
  template,
  canEdit,
  onSaved,
}: {
  template: FormTemplateRow
  canEdit: boolean
  onSaved: (next: FormTemplateRow) => void
}) {
  const [values, setValues] = useState({
    name: template.name,
    code: template.code,
    description: template.description ?? '',
    is_active: template.is_active,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setValues({
      name: template.name,
      code: template.code,
      description: template.description ?? '',
      is_active: template.is_active,
    })
    setError(null)
    setSuccess(null)
  }, [template])

  const nameError = useMemo(() => (values.name.trim() ? null : 'Name is required.'), [values.name])
  const codeError = useMemo(() => validateSlug(values.code), [values.code])
  const dirty =
    values.name !== template.name ||
    values.code !== template.code ||
    (values.description ?? '') !== (template.description ?? '') ||
    values.is_active !== template.is_active
  const canSubmit = canEdit && !submitting && !nameError && !codeError && dirty

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const next = await updateFormTemplate(template.id, {
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description.trim() || undefined,
        is_active: values.is_active,
      })
      onSaved(next)
      setSuccess('Saved.')
    } catch (e: unknown) {
      setError(parseApiError(e, 'Save failed').message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-app-text">Template basics</p>
        {success ? <span className="text-xs text-status-success">{success}</span> : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-4">
        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="tpl_name"
            label="Name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            error={nameError ?? undefined}
            disabled={!canEdit || submitting}
            required
          />
          <Input
            id="tpl_code"
            label="Code"
            value={values.code}
            onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
            error={codeError ?? undefined}
            disabled={!canEdit || submitting}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tpl_description" className="text-sm font-medium text-app-secondary">
            Description
          </label>
          <textarea
            id="tpl_description"
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            disabled={!canEdit || submitting}
            className="min-h-20 w-full rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-app-secondary">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(e) => setValues((v) => ({ ...v, is_active: e.target.checked }))}
            disabled={!canEdit || submitting}
          />
          Active
        </label>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? 'Saving...' : 'Save basics'}
          </Button>
        </div>
      </form>
    </div>
  )
}
