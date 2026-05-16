import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getUser, type UserRow } from '@/api/users'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { UserRoleAssignments } from '@/features/users/UserRoleAssignments'
import { displayName, userTypeLabel } from '@/features/users/types'

export function UserAccessPage() {
  const { userId } = useParams()
  const id = Number(userId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<UserRow | null>(null)

  async function load() {
    if (!Number.isFinite(id)) {
      setError('Invalid user id')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const u = await getUser(id)
      setUser(u)
    } catch (e: unknown) {
      setUser(null)
      setError(e instanceof Error ? e.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading access" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link to="/users" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to users
          </Link>
        </div>
        <ErrorState message={error} />
        <Button variant="secondary" onClick={() => load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <Link to="/users" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to users
        </Link>
        <ErrorState message="User not found." />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link to="/users" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Users
            </Link>
          </div>
          <h2 className="mt-2 truncate text-lg font-semibold text-app-text">Manage access</h2>
          <p className="mt-1 text-sm text-app-secondary">
            {displayName(user)} - <span className="text-app-subtle">@{user.username}</span>
          </p>
          <p className="mt-2 text-sm text-app-secondary">
            Access is assigned by choosing a role and where it applies. Assign approved roles at the company, client, or site level.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant="info">{userTypeLabel(user.user_type)}</Badge>
          {user.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
        </div>
      </div>

      <UserRoleAssignments userId={user.id} />
    </div>
  )
}
