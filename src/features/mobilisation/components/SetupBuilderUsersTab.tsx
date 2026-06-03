/**
 * Setup Builder Users Tab - User rows with access role assignment.
 */
import { useState } from 'react'
import {
  Mail,
  Phone,
  Plus,
  Send,
  Star,
  Trash2,
  UserPlus,
} from 'lucide-react'
import type { AccessRole } from '@/api/access'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { MobilisationSetupBuilderUser } from '@/features/mobilisation/types'

type LocalBuilderUser = MobilisationSetupBuilderUser & {
  local_key: string
  is_new?: boolean
}

interface SetupBuilderUsersTabProps {
  users: LocalBuilderUser[]
  setUsers: React.Dispatch<React.SetStateAction<LocalBuilderUser[]>>
  accessRoles: AccessRole[]
  accessRolesLoading: boolean
  availableSites: Array<{ id: number; name: string | null }>
  isEditable: boolean
  onDirty: () => void
}

interface UserFormState {
  full_name: string
  email: string
  phone: string
  user_type: string
  access_role: string
  scope_level: 'client' | 'site'
  real_site: string
  is_primary_contact: boolean
  send_invite_on_finalization: boolean
}

const USER_FORM_DEFAULTS: UserFormState = {
  full_name: '',
  email: '',
  phone: '',
  user_type: 'client',
  access_role: '',
  scope_level: 'client',
  real_site: '',
  is_primary_contact: false,
  send_invite_on_finalization: true,
}

export function SetupBuilderUsersTab({
  users,
  setUsers,
  accessRoles,
  accessRolesLoading,
  availableSites,
  isEditable,
  onDirty,
}: SetupBuilderUsersTabProps) {
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form, setForm] = useState<UserFormState>(USER_FORM_DEFAULTS)
  const [formError, setFormError] = useState<string | null>(null)

  function set(field: keyof UserFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function openAddDrawer() {
    setForm(USER_FORM_DEFAULTS)
    setFormError(null)
    setAddDrawerOpen(true)
  }

  function openEditDrawer(user: LocalBuilderUser) {
    setForm({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone ?? '',
      user_type: user.user_type ?? 'client',
      access_role: user.access_role ? String(user.access_role) : '',
      scope_level: user.scope_level,
      real_site: user.real_site != null ? String(user.real_site) : '',
      is_primary_contact: user.is_primary_contact,
      send_invite_on_finalization: user.send_invite_on_finalization,
    })
    setEditingKey(user.local_key)
    setFormError(null)
    setEditDrawerOpen(true)
  }

  function handleAddUser() {
    if (!form.full_name.trim()) {
      setFormError('Full name is required.')
      return
    }
    if (!form.email.trim()) {
      setFormError('Email is required.')
      return
    }
    if (!form.access_role) {
      setFormError('Access role is required.')
      return
    }
    if (form.scope_level === 'site' && !form.real_site) {
      setFormError('Site is required for site-level users.')
      return
    }

    const roleId = Number(form.access_role)
    const siteId = form.scope_level === 'site' ? Number(form.real_site) : null
    const siteName = siteId ? availableSites.find((s) => s.id === siteId)?.name ?? null : null
    const roleName = accessRoles.find((r) => r.id === roleId)?.name ?? null
    const roleCode = accessRoles.find((r) => r.id === roleId)?.code ?? null

    const newUser: LocalBuilderUser = {
      id: 0,
      local_key: `new-user-${Date.now()}`,
      is_new: true,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      user_type: form.user_type,
      access_role: roleId,
      access_role_code: roleCode,
      access_role_name: roleName,
      scope_level: form.scope_level,
      real_site: siteId,
      real_site_name: siteName,
      is_primary_contact: form.is_primary_contact,
      send_invite_on_finalization: form.send_invite_on_finalization,
      is_active: true,
    }

    setUsers((prev) => [...prev, newUser])
    onDirty()
    setAddDrawerOpen(false)
    setForm(USER_FORM_DEFAULTS)
    setFormError(null)
  }

  function handleUpdateUser() {
    if (!editingKey) return
    if (!form.full_name.trim()) {
      setFormError('Full name is required.')
      return
    }
    if (!form.email.trim()) {
      setFormError('Email is required.')
      return
    }
    if (!form.access_role) {
      setFormError('Access role is required.')
      return
    }
    if (form.scope_level === 'site' && !form.real_site) {
      setFormError('Site is required for site-level users.')
      return
    }

    const roleId = Number(form.access_role)
    const siteId = form.scope_level === 'site' ? Number(form.real_site) : null
    const siteName = siteId ? availableSites.find((s) => s.id === siteId)?.name ?? null : null
    const roleName = accessRoles.find((r) => r.id === roleId)?.name ?? null
    const roleCode = accessRoles.find((r) => r.id === roleId)?.code ?? null

    setUsers((prev) =>
      prev.map((u) => {
        if (u.local_key !== editingKey) return u
        return {
          ...u,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          user_type: form.user_type,
          access_role: roleId,
          access_role_code: roleCode,
          access_role_name: roleName,
          scope_level: form.scope_level,
          real_site: siteId,
          real_site_name: siteName,
          is_primary_contact: form.is_primary_contact,
          send_invite_on_finalization: form.send_invite_on_finalization,
        }
      }),
    )
    onDirty()
    setEditDrawerOpen(false)
    setEditingKey(null)
    setForm(USER_FORM_DEFAULTS)
    setFormError(null)
  }

  function handleRemoveUser(localKey: string) {
    setUsers((prev) => prev.filter((u) => u.local_key !== localKey))
    onDirty()
  }

  function handleTogglePrimary(localKey: string) {
    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        is_primary_contact: u.local_key === localKey ? !u.is_primary_contact : u.is_primary_contact,
      })),
    )
    onDirty()
  }

  function handleToggleInvite(localKey: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.local_key === localKey
          ? { ...u, send_invite_on_finalization: !u.send_invite_on_finalization }
          : u,
      ),
    )
    onDirty()
  }

  const userFormDrawer = (
    <div className="space-y-4">
      {formError ? <p className="text-sm text-status-danger">{formError}</p> : null}

      <Input
        id="user_full_name"
        label="Full name *"
        value={form.full_name}
        onChange={(e) => set('full_name', e.target.value)}
        placeholder="e.g. John Doe"
      />

      <Input
        id="user_email"
        label="Email *"
        type="email"
        value={form.email}
        onChange={(e) => set('email', e.target.value)}
        placeholder="e.g. john@example.com"
      />

      <Input
        id="user_phone"
        label="Phone"
        value={form.phone}
        onChange={(e) => set('phone', e.target.value)}
        placeholder="e.g. 9876543210"
      />

      <Select
        id="user_access_role"
        label="Access role *"
        value={form.access_role}
        onChange={(e) => set('access_role', e.target.value)}
        disabled={accessRolesLoading}
      >
        <option value="">{accessRolesLoading ? 'Loading roles...' : 'Select a role'}</option>
        {accessRoles.map((role) => (
          <option key={role.id} value={String(role.id)}>
            {role.name}
          </option>
        ))}
      </Select>

      <Select
        id="user_scope_level"
        label="Scope level"
        value={form.scope_level}
        onChange={(e) => set('scope_level', e.target.value as 'client' | 'site')}
      >
        <option value="client">Client-level</option>
        <option value="site">Site-level</option>
      </Select>

      {form.scope_level === 'site' ? (
        <Select
          id="user_site"
          label="Site *"
          value={form.real_site}
          onChange={(e) => set('real_site', e.target.value)}
        >
          <option value="">Select a site</option>
          {availableSites.map((site) => (
            <option key={site.id} value={String(site.id)}>
              {site.name ?? `Site #${site.id}`}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="space-y-3 pt-2 border-t border-app-border">
        <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_primary_contact}
            onChange={(e) => set('is_primary_contact', e.target.checked)}
            className="rounded border-app-border"
          />
          <span>Primary contact</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-app-text cursor-pointer">
          <input
            type="checkbox"
            checked={form.send_invite_on_finalization}
            onChange={(e) => set('send_invite_on_finalization', e.target.checked)}
            className="rounded border-app-border mt-0.5"
          />
          <div>
            <span>Send invite after finalization</span>
            <p className="text-xs text-app-subtle mt-0.5">User can receive system access invite email</p>
          </div>
        </label>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Add user button */}
      {isEditable ? (
        <div className="flex justify-end">
          <Button variant="secondary" className="min-h-9" onClick={openAddDrawer}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add user
          </Button>
        </div>
      ) : null}

      {/* User cards/rows */}
      {users.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50/50 to-slate-50 dark:from-brand-900/10 dark:to-slate-800/20 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
            <UserPlus className="h-7 w-7 text-brand-600 dark:text-brand-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-app-text">No client users added yet</p>
          {isEditable ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-app-secondary">
                Add users who will access the system after finalization.
              </p>
              <p className="text-xs text-app-subtle">
                Users can receive invite emails once the mobilisation is finalized.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserCard
              key={user.local_key}
              user={user}
              isEditable={isEditable}
              onEdit={() => openEditDrawer(user)}
              onRemove={() => handleRemoveUser(user.local_key)}
              onTogglePrimary={() => handleTogglePrimary(user.local_key)}
              onToggleInvite={() => handleToggleInvite(user.local_key)}
            />
          ))}
        </div>
      )}

      {/* Add user drawer */}
      <Drawer
        open={addDrawerOpen}
        title="Add user"
        description="Add a new client user for this mobilisation."
        onClose={() => setAddDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add</Button>
          </div>
        }
      >
        {userFormDrawer}
      </Drawer>

      {/* Edit user drawer */}
      <Drawer
        open={editDrawerOpen}
        title="Edit user"
        description="Update user details."
        onClose={() => setEditDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Save</Button>
          </div>
        }
      >
        {userFormDrawer}
      </Drawer>
    </div>
  )
}

// ─── User Card Component ───────────────────────────────────────────────────────

interface UserCardProps {
  user: LocalBuilderUser
  isEditable: boolean
  onEdit: () => void
  onRemove: () => void
  onTogglePrimary: () => void
  onToggleInvite: () => void
}

function UserCard({
  user,
  isEditable,
  onEdit,
  onRemove,
  onTogglePrimary,
  onToggleInvite,
}: UserCardProps) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-app-text">{user.full_name}</p>
            {user.is_primary_contact ? (
              <div className="flex items-center gap-1 text-amber-600">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-xs font-medium">Primary</span>
              </div>
            ) : null}
            <Badge variant={user.scope_level === 'site' ? 'info' : 'neutral'} className="text-xs">
              {user.scope_level === 'site' ? 'Site' : 'Client'}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-app-secondary">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {user.email}
            </span>
            {user.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {user.phone}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {user.access_role_name ? (
              <Badge variant="neutral" className="text-xs">
                {user.access_role_name}
              </Badge>
            ) : null}
            {user.real_site_name ? (
              <span className="text-xs text-app-subtle">Site: {user.real_site_name}</span>
            ) : null}
            {user.send_invite_on_finalization ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Send className="h-3 w-3" />
                Can receive invite
              </span>
            ) : (
              <span className="text-xs text-app-subtle">No invite</span>
            )}
          </div>
        </div>

        {isEditable ? (
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              className="min-h-8 px-3 text-xs"
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              className="min-h-8 px-2"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Quick toggles - inline when editable */}
      {isEditable ? (
        <div className="mt-3 pt-3 border-t border-app-border flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-app-secondary cursor-pointer hover:text-app-text transition-colors">
            <input
              type="checkbox"
              checked={user.is_primary_contact}
              onChange={onTogglePrimary}
              className="rounded border-app-border"
            />
            Primary contact
          </label>
          <label className="flex items-center gap-2 text-xs text-app-secondary cursor-pointer hover:text-app-text transition-colors">
            <input
              type="checkbox"
              checked={user.send_invite_on_finalization}
              onChange={onToggleInvite}
              className="rounded border-app-border"
            />
            Can receive invite after finalization
          </label>
        </div>
      ) : null}
    </div>
  )
}
