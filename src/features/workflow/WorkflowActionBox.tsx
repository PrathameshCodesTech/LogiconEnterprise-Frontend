import { useState } from 'react'
import { actOnWorkflowStep } from '@/api/workflow'
import { parseApiError } from '@/lib/apiError'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import type { WorkflowAction } from '@/features/workflow/types'

export function WorkflowActionBox({
  instanceId,
  stepId,
  workflowStatus,
  assignedUserId,
  meId,
  isSuperuser,
  canApprove,
  canReject,
  onSuccess,
}: {
  instanceId: number
  stepId: number
  workflowStatus: string | undefined
  assignedUserId: number | null | undefined
  meId: number | undefined
  isSuperuser: boolean
  canApprove: boolean
  canReject: boolean
  onSuccess: () => Promise<void>
}) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive = workflowStatus === 'active'
  const isAssignee = meId != null && assignedUserId != null && meId === assignedUserId
  const canActHere = isSuperuser || isAssignee

  if (!isActive || !stepId || !canActHere) {
    return null
  }

  async function submit(action: WorkflowAction) {
    setError(null)
    if (action !== 'approve') {
      const t = comment.trim()
      if (!t) {
        setError(action === 'reject' ? 'Comment is required to reject.' : 'Comment is required to request changes.')
        return
      }
    }
    setSubmitting(true)
    try {
      await actOnWorkflowStep(instanceId, stepId, {
        action,
        comment: comment.trim() || undefined,
      })
      setComment('')
      await onSuccess()
    } catch (e: unknown) {
      setError(parseApiError(e, 'Action failed').message)
    } finally {
      setSubmitting(false)
    }
  }

  // ActOnStepView allows the assigned user or superuser without workflow.approve / workflow.reject.
  // Capability flags still help for delegated admins who are not the assignee (box hidden for them).
  const showApprove = isAssignee || isSuperuser || canApprove
  const showReject = isAssignee || isSuperuser || canReject
  const showRequestChanges = isAssignee || isSuperuser || canReject

  return (
    <div className="rounded-panel border border-app-border bg-app-muted p-4 shadow-panel">
      <p className="text-sm font-semibold text-app-text">Step actions</p>
      <p className="mt-1 text-xs text-app-secondary">
        If you are assigned to this step, you can act here even without separate approve/reject capabilities (the API
        enforces access). Reject and request changes require a comment.
      </p>

      {error ? <div className="mt-3"><ErrorState message={error} /></div> : null}

      <div className="mt-4 space-y-3">
        <Input
          id="wf_act_comment"
          label="Comment (required for reject / request changes)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={submitting}
        />
        <div className="flex flex-wrap gap-2">
          {showApprove ? (
            <Button className="min-h-9" disabled={submitting} onClick={() => void submit('approve')}>
              Approve
            </Button>
          ) : null}
          {showReject ? (
            <Button variant="danger" className="min-h-9" disabled={submitting} onClick={() => void submit('reject')}>
              Reject
            </Button>
          ) : null}
          {showRequestChanges ? (
            <Button variant="secondary" className="min-h-9" disabled={submitting} onClick={() => void submit('request_changes')}>
              Request changes
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
