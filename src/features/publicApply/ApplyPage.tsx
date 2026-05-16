import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { getPublicCampaignByToken } from '@/api/publicCampaigns'
import { createPublicSubmission } from '@/api/publicSubmissions'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { PublicApplyLayout } from '@/features/publicApply/PublicApplyLayout'
import { FormFieldRenderer } from '@/features/publicApply/FormFieldRenderer'
import { SuccessState } from '@/features/publicApply/SuccessState'
import { t } from '@/features/publicApply/i18n'
import { FileUploadField } from '@/features/publicApply/FileUploadField'
import {
  isEmptyFieldValue,
  validateBusinessRules,
  validateMobile10Digits,
  validateRequiredFields,
} from '@/features/publicApply/validation'
import type { LangCode, PublicCampaign, PublicFormField, PublicRole } from '@/features/publicApply/types'

type CandidateValues = {
  first_name: string
  middle_name: string
  last_name: string
  mobile_number: string // 10 digits only
  role_id: string // '' | role id | 'other'
  other_role_title: string
}

function keyForFieldValue(field: PublicFormField): string {
  return field.field_key
}

export function ApplyPage() {
  const { token } = useParams<{ token: string }>()

  const [campaign, setCampaign] = useState<PublicCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [lang, setLang] = useState<LangCode>('en')

  const [candidate, setCandidate] = useState<CandidateValues>({
    first_name: '',
    middle_name: '',
    last_name: '',
    mobile_number: '',
    role_id: '',
    other_role_title: '',
  })

  const [fieldValues, setFieldValues] = useState<Record<number, unknown>>({})
  const [fieldFiles, setFieldFiles] = useState<Record<number, File | null>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({})

  const [resume, setResume] = useState<File | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [duplicate, setDuplicate] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError(t('en', 'invalidLink'))
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    getPublicCampaignByToken(token)
      .then((data) => {
        setCampaign(data)
        const initialLang = (data.default_language ?? 'en') as LangCode
        setLang(initialLang)
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setLoadError(t('en', 'invalidLink'))
        } else {
          setLoadError(t('en', 'loadError'))
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  const roles: PublicRole[] = useMemo(() => campaign?.roles ?? [], [campaign])
  const enabledLanguages = useMemo(() => campaign?.enabled_languages ?? ['en'], [campaign])
  const showLanguage = enabledLanguages.length > 1

  const activeRoleFields: PublicFormField[] = useMemo(() => {
    if (!campaign) return []
    if (!candidate.role_id || candidate.role_id === 'other') return []
    return campaign.role_fields?.[candidate.role_id] ?? []
  }, [campaign, candidate.role_id])

  const allFields: PublicFormField[] = useMemo(() => {
    if (!campaign) return []
    return [...(campaign.common_fields ?? []), ...activeRoleFields]
  }, [campaign, activeRoleFields])

  const totalFiles = useMemo(() => {
    const dynamicFiles = Object.values(fieldFiles).filter(Boolean).length
    return (resume ? 1 : 0) + dynamicFiles
  }, [resume, fieldFiles])

  function setFieldValue(fieldId: number, next: unknown) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: next }))
    setFieldErrors((prev) => {
      const n = { ...prev }
      delete n[fieldId]
      return n
    })
  }

  function setFieldFile(fieldId: number, file: File | null, errKey: string | null) {
    setFieldFiles((prev) => ({ ...prev, [fieldId]: file }))
    setFieldErrors((prev) => {
      const n = { ...prev }
      if (errKey) n[fieldId] = errKey
      else delete n[fieldId]
      return n
    })
  }

  async function submit() {
    if (!campaign || !token || submitting) return
    setGlobalError(null)

    // Candidate validations
    const nextGlobalErrors: string[] = []
    if (!candidate.first_name.trim()) nextGlobalErrors.push(t(lang, 'required'))
    if (!candidate.last_name.trim()) nextGlobalErrors.push(t(lang, 'required'))
    const mobileErr = validateMobile10Digits(candidate.mobile_number)
    if (mobileErr) nextGlobalErrors.push(t(lang, mobileErr as Parameters<typeof t>[1]))

    if (!candidate.role_id) {
      nextGlobalErrors.push(t(lang, 'required'))
    } else if (candidate.role_id === 'other') {
      if (!candidate.other_role_title.trim() || candidate.other_role_title.trim().length < 2) {
        nextGlobalErrors.push(t(lang, 'required'))
      }
    }

    // Resume mandatory
    if (!resume) {
      setResumeError('resumeRequired')
    }

    if (totalFiles > 5) {
      nextGlobalErrors.push(t(lang, 'maxFiles'))
    }

    // Dynamic required field validations (includes required dynamic file fields)
    const requiredErrors = validateRequiredFields(allFields, fieldValues, fieldFiles)
    // Clear old required errors then set new
    setFieldErrors((prev) => ({ ...prev, ...requiredErrors }))

    // Business rules based on field_key values
    const valuesByKey: Record<string, unknown> = {}
    for (const f of allFields) {
      if (f.field_type === 'file') continue
      const v = fieldValues[f.id]
      valuesByKey[keyForFieldValue(f)] = v
    }
    const businessErrKeys = validateBusinessRules(valuesByKey)
    if (businessErrKeys.length) {
      nextGlobalErrors.push(...businessErrKeys.map((k) => t(lang, k as any)))
    }

    if (nextGlobalErrors.length) {
      setGlobalError(nextGlobalErrors[0] ?? t(lang, 'submitError'))
      return
    }
    if (Object.keys(requiredErrors).length) {
      setGlobalError(t(lang, 'submitError'))
      return
    }
    if (!resume || resumeError) {
      setGlobalError(t(lang, 'submitError'))
      return
    }

    // Build answers JSON excluding file fields
    const answers = allFields
      .filter((f) => f.field_type !== 'file')
      .map((f) => ({ field_id: f.id, value: fieldValues[f.id] }))
      .filter((a) => !isEmptyFieldValue(a.value))

    const formData = new FormData()
    formData.append('campaign_token', token)
    formData.append('mobile_number', candidate.mobile_number)
    formData.append('first_name', candidate.first_name.trim())
    formData.append('middle_name', candidate.middle_name.trim())
    formData.append('last_name', candidate.last_name.trim())
    formData.append('language', lang)

    if (candidate.role_id && candidate.role_id !== 'other') {
      formData.append('job_role_id', candidate.role_id)
    } else {
      if (candidate.other_role_title.trim()) {
        formData.append('other_role_title', candidate.other_role_title.trim())
      }
    }

    formData.append('answers', JSON.stringify(answers))

    // Files: resume mandatory + dynamic file fields as field_<id>
    formData.append('resume', resume)
    for (const f of allFields) {
      if (f.field_type !== 'file') continue
      const file = fieldFiles[f.id]
      if (file) {
        formData.append(`field_${f.id}`, file)
      }
    }

    setSubmitting(true)
    try {
      const res = await createPublicSubmission(formData)
      setDuplicate(Boolean(res.is_possible_duplicate))
      setSubmitted(true)
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.data) {
        const data = e.response.data as unknown
        if (data && typeof data === 'object') {
          const msg = Object.values(data as Record<string, unknown>)
            .flatMap((v) => (Array.isArray(v) ? v : [v]))
            .map((v) => (typeof v === 'string' ? v : ''))
            .filter(Boolean)
            .join(' ')
          setGlobalError(msg || t(lang, 'submitError'))
        } else {
          setGlobalError(t(lang, 'submitError'))
        }
      } else {
        setGlobalError(t(lang, 'submitError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PublicApplyLayout lang="en">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <Spinner label={t('en', 'loading')} />
        </div>
      </PublicApplyLayout>
    )
  }

  if (loadError) {
    return (
      <PublicApplyLayout lang="en">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <ErrorState message={loadError} />
        </div>
      </PublicApplyLayout>
    )
  }

  if (!campaign) {
    return (
      <PublicApplyLayout lang="en">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <ErrorState message={t('en', 'loadError')} />
        </div>
      </PublicApplyLayout>
    )
  }

  if (submitted) {
    return (
      <PublicApplyLayout lang={lang}>
        <SuccessState
          lang={lang}
          campaignTitle={campaign.title}
          isDuplicate={duplicate}
          onBack={() => {
            setSubmitted(false)
            setDuplicate(false)
          }}
        />
      </PublicApplyLayout>
    )
  }

  return (
    <PublicApplyLayout
      lang={lang}
      headerRight={
        showLanguage ? (
          <div className="flex items-center gap-2">
            <label htmlFor="apply_lang" className="text-xs font-semibold uppercase tracking-widest text-app-subtle">
              {t(lang, 'language')}
            </label>
            <select
              id="apply_lang"
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
              className="min-h-9 rounded-panel border border-app-border bg-app-surface px-3 text-sm text-app-text shadow-panel focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {campaign.languages?.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native_label}
                </option>
              ))}
            </select>
          </div>
        ) : null
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-app-text">{campaign.title}</h1>
          {campaign.site ? (
            <p className="mt-1 text-sm text-app-secondary">
              {campaign.site.name} - {campaign.site.city}, {campaign.site.state}
            </p>
          ) : null}
        </div>

        {globalError ? <ErrorState message={globalError} /> : null}

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="first_name" className="text-sm font-medium text-app-secondary">
                {t(lang, 'firstName')} <span className="text-status-danger">*</span>
              </label>
              <input
                id="first_name"
                value={candidate.first_name}
                onChange={(e) => setCandidate((v) => ({ ...v, first_name: e.target.value }))}
                className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="middle_name" className="text-sm font-medium text-app-secondary">
                {t(lang, 'middleName')}
              </label>
              <input
                id="middle_name"
                value={candidate.middle_name}
                onChange={(e) => setCandidate((v) => ({ ...v, middle_name: e.target.value }))}
                className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="last_name" className="text-sm font-medium text-app-secondary">
                {t(lang, 'lastName')} <span className="text-status-danger">*</span>
              </label>
              <input
                id="last_name"
                value={candidate.last_name}
                onChange={(e) => setCandidate((v) => ({ ...v, last_name: e.target.value }))}
                className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="mobile_number" className="text-sm font-medium text-app-secondary">
              {t(lang, 'mobile')} <span className="text-status-danger">*</span>
            </label>
            <div className="flex items-center overflow-hidden rounded-panel border border-app-border bg-app-surface shadow-panel focus-within:ring-2 focus-within:ring-brand-500/30">
              <span className="border-r border-app-border bg-app-muted px-3 py-2 text-sm text-app-secondary">+91</span>
              <input
                id="mobile_number"
                inputMode="numeric"
                value={candidate.mobile_number}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setCandidate((v) => ({ ...v, mobile_number: digits }))
                }}
                className="min-h-10 w-full bg-app-surface px-3 py-2 text-sm text-app-text outline-none placeholder:text-app-subtle"
                placeholder="10 digits"
                disabled={submitting}
              />
            </div>
            {validateMobile10Digits(candidate.mobile_number) ? (
              <p className="text-sm text-status-danger" role="alert">
                {t(lang, 'mobileInvalid')}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="role_id" className="text-sm font-medium text-app-secondary">
                {t(lang, 'role')} <span className="text-status-danger">*</span>
              </label>
              <select
                id="role_id"
                value={candidate.role_id}
                onChange={(e) =>
                  setCandidate((v) => ({
                    ...v,
                    role_id: e.target.value,
                    other_role_title: e.target.value === 'other' ? v.other_role_title : '',
                  }))
                }
                className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                disabled={submitting}
              >
                <option value="">Select...</option>
                {roles.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
                <option value="other">Other</option>
              </select>
            </div>

            {candidate.role_id === 'other' ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="other_role_title" className="text-sm font-medium text-app-secondary">
                  {t(lang, 'otherRole')} <span className="text-status-danger">*</span>
                </label>
                <input
                  id="other_role_title"
                  value={candidate.other_role_title}
                  onChange={(e) => setCandidate((v) => ({ ...v, other_role_title: e.target.value }))}
                  className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  placeholder={t(lang, 'otherRolePlaceholder')}
                  disabled={submitting}
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
            <p className="text-sm font-semibold text-app-text">{t(lang, 'resume')}</p>
            <p className="mt-1 text-xs text-app-secondary">{t(lang, 'resumeRequired')}</p>
            <div className="mt-3">
              <FileUploadField
                id="resume"
                label={t(lang, 'resume')}
                lang={lang}
                file={resume}
                required
                errorKey={resumeError}
                disabled={submitting}
                onChange={(file, errKey) => {
                  setResume(file)
                  setResumeError(errKey)
                }}
              />
            </div>
          </div>

          {allFields.length ? (
            <div className="space-y-4">
              {allFields.map((field) => (
                <FormFieldRenderer
                  key={field.id}
                  field={field}
                  lang={lang}
                  value={fieldValues[field.id]}
                  file={fieldFiles[field.id] ?? null}
                  errorKey={fieldErrors[field.id] ?? null}
                  disabled={submitting}
                  onChangeValue={(next) => setFieldValue(field.id, next)}
                  onChangeFile={(file, err) => setFieldFile(field.id, file, err)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 pb-8">
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? t(lang, 'submitting') : t(lang, 'submit')}
          </Button>
        </div>
      </div>
    </PublicApplyLayout>
  )
}


