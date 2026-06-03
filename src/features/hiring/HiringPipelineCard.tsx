import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoveRight, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { hiringApplicationStatusLabel } from '@/features/talent/talentLabels'
import { statusBadgeVariant } from '@/features/hiring/hiringPipelineUtils'
import type { HiringApplicationRow } from '@/features/hiring/types'

export function HiringPipelineCard({
  app,
  canMove,
  onMove,
}: {
  app: HiringApplicationRow
  canMove: boolean
  onMove: (app: HiringApplicationRow) => void
}) {
  const [isDragging, setIsDragging] = useState(false)

  const meta = [app.job_role_name, app.site_name, app.client_name].filter(Boolean).join(' · ')

  return (
    <div
      draggable={canMove}
      onDragStart={(e) => {
        setIsDragging(true)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('application_id', String(app.id))
        e.dataTransfer.setData('from_stage_id', String(app.current_stage ?? ''))
      }}
      onDragEnd={() => setIsDragging(false)}
      className={cn(
        'space-y-2 rounded-panel border border-app-border bg-app-surface p-3 shadow-panel transition-opacity',
        canMove && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          to={`/hiring/applications/${app.id}`}
          className="min-w-0 flex-1 text-sm font-medium leading-tight text-app-text hover:text-brand-600"
          onClick={(e) => isDragging && e.preventDefault()}
        >
          {app.candidate_name ?? `Candidate #${app.candidate}`}
        </Link>
        <Badge variant={statusBadgeVariant(app.status)} className="shrink-0 text-[10px]">
          {hiringApplicationStatusLabel(app.status)}
        </Badge>
      </div>

      {app.candidate_phone ? (
        <div className="flex items-center gap-1 text-xs text-app-secondary">
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          {app.candidate_phone}
        </div>
      ) : null}

      {meta ? <p className="truncate text-xs text-app-secondary">{meta}</p> : null}

      {app.mrf ? <p className="text-xs text-app-subtle">MRF #{app.mrf}</p> : null}

      {app.updated_at ? (
        <p className="text-xs text-app-subtle">{new Date(app.updated_at).toLocaleDateString()}</p>
      ) : null}

      {canMove ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onMove(app)}
          className="min-h-0 h-7 w-full gap-1 py-0 px-2 text-xs"
        >
          <MoveRight className="h-3 w-3" aria-hidden />
          Move
        </Button>
      ) : null}
    </div>
  )
}
