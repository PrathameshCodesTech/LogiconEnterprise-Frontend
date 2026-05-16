import { useMemo } from 'react'
import { Paperclip } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/features/publicApply/i18n'
import { validateFileBasic } from '@/features/publicApply/validation'
import type { LangCode } from '@/features/publicApply/types'

export function FileUploadField({
  id,
  label,
  lang,
  file,
  required,
  errorKey,
  disabled,
  onChange,
}: {
  id: string
  label: string
  lang: LangCode
  file: File | null
  required?: boolean
  errorKey?: string | null
  disabled?: boolean
  onChange: (file: File | null, errorKey: string | null) => void
}) {
  const display = useMemo(() => {
    if (!file) return 'Choose file...'
    const kb = Math.max(1, Math.round(file.size / 1024))
    return `${file.name} - ${kb} KB`
  }, [file])

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-app-secondary">
        {label} {required ? <span className="text-status-danger">*</span> : null}
      </label>
      <div className={cn('flex items-center gap-2 rounded-panel border border-app-border bg-app-surface px-3 py-2 shadow-panel', errorKey && 'border-status-danger')}>
        <Paperclip className="h-4 w-4 text-app-subtle" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-app-secondary">{display}</span>
        <input
          id={id}
          type="file"
          className="text-sm"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            if (!f) {
              onChange(null, null)
              return
            }
            const err = validateFileBasic(f)
            onChange(f, err)
          }}
        />
      </div>
      {errorKey ? (
        <p className="text-sm text-status-danger" role="alert">
          {t(lang, errorKey as Parameters<typeof t>[1])}
        </p>
      ) : null}
    </div>
  )
}


