/**
 * Setup Builder Readiness Panel - Validation status and completion controls.
 */
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Loader2,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type {
  MobilisationSetupBuilderRole,
  MobilisationSetupBuilderValidation,
} from '@/features/mobilisation/types'

interface SetupBuilderReadinessPanelProps {
  validation: MobilisationSetupBuilderValidation | null
  unassignedRolesCount: number
  totalRolesCount: number
  unassignedRoles: MobilisationSetupBuilderRole[]
  departmentsCount: number
  usersCount: number
  isDirty: boolean
  isEditable: boolean
  isCompletingSetup: boolean
  onMarkSetupCompleted: () => void
}

// Translate backend validation errors to user-friendly messages
function translateValidationError(
  error: string,
  unassignedRoles: MobilisationSetupBuilderRole[],
): string {
  // Handle "Missing SRR ids:" errors - translate to role names
  if (error.includes('Missing SRR ids:') || error.includes('site role requirement')) {
    if (unassignedRoles.length === 0) {
      return 'All roles must be assigned to departments.'
    }
    const roleNames = [...new Set(unassignedRoles.map((r) => r.job_role_name ?? 'Unknown Role'))]
    if (roleNames.length <= 3) {
      return `Assign remaining roles: ${roleNames.join(', ')}`
    }
    return `${unassignedRoles.length} roles still need assignment: ${roleNames.slice(0, 3).join(', ')} +${roleNames.length - 3} more`
  }

  // Handle "at least one active proposed department"
  if (error.toLowerCase().includes('at least one') && error.toLowerCase().includes('department')) {
    return 'Add at least one department to continue.'
  }

  // Handle "at least one active proposed user"
  if (error.toLowerCase().includes('at least one') && error.toLowerCase().includes('user')) {
    return 'Add at least one user who can access the system.'
  }

  // Return original for unknown errors (but strip any ID references)
  return error.replace(/\s*\(?(?:SRR\s*)?ids?:?\s*[\d,\s]+\)?/gi, '').trim()
}

export function SetupBuilderReadinessPanel({
  validation,
  unassignedRolesCount,
  totalRolesCount,
  unassignedRoles,
  departmentsCount,
  usersCount,
  isDirty,
  isEditable,
  isCompletingSetup,
  onMarkSetupCompleted,
}: SetupBuilderReadinessPanelProps) {
  const isReady = validation?.ok === true && !isDirty
  const hasErrors = validation?.errors && validation.errors.length > 0
  const hasWarnings = validation?.warnings && validation.warnings.length > 0

  // Translate validation errors to friendly messages
  const friendlyErrors = validation?.errors?.map((e) => translateValidationError(e, unassignedRoles)) ?? []

  // Journey steps status
  const hasDepartments = departmentsCount > 0
  const hasUsers = usersCount > 0
  const allRolesAssigned = unassignedRolesCount === 0
  const isSaved = !isDirty

  // Determine button disabled state and specific next action
  let buttonDisabled = true
  let disabledReason = ''

  if (!isEditable) {
    buttonDisabled = true
    disabledReason = 'Setup is locked in the current status.'
  } else if (!hasDepartments) {
    buttonDisabled = true
    disabledReason = 'Next: Add at least one department.'
  } else if (!allRolesAssigned) {
    buttonDisabled = true
    const roleNames = [...new Set(unassignedRoles.slice(0, 2).map((r) => r.job_role_name ?? 'Role'))]
    const suffix = unassignedRolesCount > 2 ? ` +${unassignedRolesCount - 2} more` : ''
    disabledReason = `Next: Assign ${unassignedRolesCount} role${unassignedRolesCount !== 1 ? 's' : ''} (${roleNames.join(', ')}${suffix}).`
  } else if (!hasUsers) {
    buttonDisabled = true
    disabledReason = 'Next: Add at least one user.'
  } else if (isDirty) {
    buttonDisabled = true
    disabledReason = 'Next: Save your changes.'
  } else if (isCompletingSetup) {
    buttonDisabled = true
    disabledReason = 'Completing setup...'
  } else {
    buttonDisabled = false
    disabledReason = ''
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-app-border bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-sm">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-app-text">Setup Readiness</h3>
              <p className="text-xs text-app-secondary">Complete all steps to finalize</p>
            </div>
          </div>

          {/* Status badge */}
          {isDirty ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 shadow-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Unsaved</span>
            </div>
          ) : isReady ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Ready</span>
            </div>
          ) : hasErrors ? (
            <div className="flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 shadow-sm">
              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300">Pending</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Compact Journey Checklist */}
        <div className="rounded-lg bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Step 1: Departments */}
            <div className="flex items-center gap-2">
              {hasDepartments ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${hasDepartments ? 'text-emerald-700 dark:text-emerald-400' : 'text-app-secondary'}`}>
                  Departments
                </p>
                <p className="text-[10px] text-app-subtle">{departmentsCount} added</p>
              </div>
            </div>

            {/* Step 2: Roles Assigned */}
            <div className="flex items-center gap-2">
              {allRolesAssigned ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${allRolesAssigned ? 'text-emerald-700 dark:text-emerald-400' : 'text-app-secondary'}`}>
                  Roles
                </p>
                <p className="text-[10px] text-app-subtle">
                  {totalRolesCount - unassignedRolesCount}/{totalRolesCount} assigned
                </p>
              </div>
            </div>

            {/* Step 3: Users */}
            <div className="flex items-center gap-2">
              {hasUsers ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${hasUsers ? 'text-emerald-700 dark:text-emerald-400' : 'text-app-secondary'}`}>
                  Users
                </p>
                <p className="text-[10px] text-app-subtle">{usersCount} added</p>
              </div>
            </div>

            {/* Step 4: Saved */}
            <div className="flex items-center gap-2">
              {isSaved ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${isSaved ? 'text-emerald-700 dark:text-emerald-400' : 'text-app-secondary'}`}>
                  Saved
                </p>
                <p className="text-[10px] text-app-subtle">{isSaved ? 'Up to date' : 'Pending'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dirty state message */}
        {isDirty ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You have unsaved changes. Save to update validation.
              </p>
            </div>
          </div>
        ) : null}

        {/* Validation errors - translated to friendly messages */}
        {!isDirty && friendlyErrors.length > 0 ? (
          <div className="space-y-1.5">
            {friendlyErrors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3"
              >
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Validation warnings */}
        {!isDirty && hasWarnings ? (
          <div className="space-y-1.5">
            {validation.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Unassigned roles hint with role names */}
        {unassignedRolesCount > 0 && !isDirty && !hasErrors ? (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {unassignedRolesCount} role{unassignedRolesCount !== 1 ? 's' : ''} need assignment:
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {[...new Set(unassignedRoles.map((r) => r.job_role_name ?? 'Unknown'))].slice(0, 5).join(', ')}
                {unassignedRoles.length > 5 ? ` +${unassignedRoles.length - 5} more` : ''}
              </p>
            </div>
          </div>
        ) : null}

        {/* Ready message */}
        {isReady && unassignedRolesCount === 0 ? (
          <div className="flex items-start gap-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Setup is ready!
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Mark setup completed to proceed to approval/finalization.
              </p>
            </div>
          </div>
        ) : null}

        {/* Mark setup completed button */}
        {isEditable ? (
          <div className="pt-2 border-t border-app-border">
            {disabledReason && buttonDisabled ? (
              <div className="flex items-center gap-2 mb-3 text-xs text-app-subtle bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-brand-500" />
                {disabledReason}
              </div>
            ) : null}
            <Button
              variant="primary"
              className="w-full"
              disabled={buttonDisabled}
              onClick={onMarkSetupCompleted}
            >
              {isCompletingSetup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing setup...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark Setup Completed
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
