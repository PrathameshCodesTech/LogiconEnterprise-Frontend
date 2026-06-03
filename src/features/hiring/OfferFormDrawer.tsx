import { useEffect, useState } from 'react'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import {
  acceptOffer,
  createOffer,
  declineOffer,
  expireOffer,
  releaseOffer,
  updateOffer,
  withdrawOffer,
} from '@/api/hiring'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import type { OfferRow } from '@/features/hiring/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

function offerStatusVariant(s: string): 'neutral' | 'info' | 'success' | 'danger' | 'warning' | 'attention' {
  if (s === 'draft') return 'neutral'
  if (s === 'released') return 'info'
  if (s === 'accepted') return 'success'
  if (s === 'declined') return 'danger'
  if (s === 'withdrawn') return 'attention'
  if (s === 'expired') return 'warning'
  return 'neutral'
}

// ─── KV row ───────────────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-32 shrink-0 text-xs text-app-secondary">{label}</span>
      <span className="text-xs text-app-text break-all">{value ?? '-'}</span>
    </div>
  )
}

// ─── Action panel ─────────────────────────────────────────────────────────────

function ActionPanel({
  label,
  onConfirm,
  busy,
  error,
  variant,
}: {
  label: string
  onConfirm: (note: string) => void
  busy: boolean
  error: string | null
  variant?: 'primary' | 'danger' | 'secondary'
}) {
  const [note, setNote] = useState('')
  return (
    <div className="rounded border border-app-border bg-app-muted/40 p-3 space-y-2">
      <textarea
        className="w-full rounded border border-app-border bg-app-surface px-2 py-1.5 text-xs text-app-text placeholder-app-muted focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
        rows={2}
        placeholder="Add a note (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={busy}
      />
      {error ? <p className="text-xs text-status-danger">{error}</p> : null}
      <Button
        type="button"
        variant={variant ?? 'primary'}
        className="min-h-8 text-xs w-full"
        disabled={busy}
        onClick={() => onConfirm(note.trim())}
      >
        {busy ? 'Saving…' : label}
      </Button>
    </div>
  )
}

// ─── OfferFormDrawer ─────────────────────────────────────────────────────────

export function OfferFormDrawer({
  open,
  onClose,
  applicationId,
  offer,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  applicationId?: number
  offer?: OfferRow | null
  onSuccess: (updated: OfferRow) => void
}) {
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canCreate = hasAnyCapability(meCaps, [CAP.OFFER_CREATE])
  const canUpdate = hasAnyCapability(meCaps, [CAP.OFFER_UPDATE])
  const canRelease = hasAnyCapability(meCaps, [CAP.OFFER_APPROVE, CAP.OFFER_MANAGE])
  const canWithdrawExpire = hasAnyCapability(meCaps, [CAP.OFFER_MANAGE])

  const isCreate = !offer
  const isDraft = offer?.status === 'draft'
  const isReleased = offer?.status === 'released'

  const [ctc, setCtc] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [notes, setNotes] = useState('')
  const [appId, setAppId] = useState('')

  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setCtc(offer?.offered_ctc != null ? String(offer.offered_ctc) : '')
      setJoiningDate(offer?.joining_date ?? '')
      setNotes(offer?.notes ?? '')
      setAppId(applicationId ? String(applicationId) : '')
      setSaveError(null)
      setActiveAction(null)
      setActionErrors({})
    }
  }, [open, offer, applicationId])

  async function handleSave() {
    const ctcNum = parseFloat(ctc)
    if (!Number.isFinite(ctcNum) || ctcNum < 0.01) {
      setSaveError('Enter a valid CTC (minimum 0.01).')
      return
    }
    setSaveBusy(true)
    setSaveError(null)
    try {
      let result: OfferRow
      if (isCreate) {
        const aid = applicationId ?? parseInt(appId, 10)
        if (!Number.isFinite(aid)) {
          setSaveError('Enter a valid application ID.')
          setSaveBusy(false)
          return
        }
        result = await createOffer({
          hiring_application: aid,
          offered_ctc: ctcNum,
          joining_date: joiningDate || undefined,
          notes: notes.trim() || undefined,
        })
      } else {
        result = await updateOffer(offer!.id, {
          offered_ctc: ctcNum,
          joining_date: joiningDate || undefined,
          notes: notes.trim() || undefined,
        })
      }
      onSuccess(result)
      onClose()
    } catch (e: unknown) {
      setSaveError(parseApiError(e, 'Could not save offer').message)
    } finally {
      setSaveBusy(false)
    }
  }

  async function doAction(action: string, note: string) {
    if (!offer) return
    setActionBusy(true)
    setActionErrors((prev) => ({ ...prev, [action]: '' }))
    try {
      const payload = { note }
      let result: OfferRow
      if (action === 'release') result = await releaseOffer(offer.id, payload)
      else if (action === 'accept') result = await acceptOffer(offer.id, payload)
      else if (action === 'decline') result = await declineOffer(offer.id, payload)
      else if (action === 'withdraw') result = await withdrawOffer(offer.id, payload)
      else if (action === 'expire') result = await expireOffer(offer.id, payload)
      else return
      onSuccess(result)
      onClose()
    } catch (e: unknown) {
      setActionErrors((prev) => ({
        ...prev,
        [action]: parseApiError(e, `Could not ${action} offer`).message,
      }))
    } finally {
      setActionBusy(false)
    }
  }

  const title = isCreate
    ? 'Create offer'
    : `Offer #${offer!.id} — ${offer!.status}`

  const showEditForm = (isCreate && canCreate) || (isDraft && canUpdate)

  return (
    <Drawer
      open={open}
      onClose={() => !saveBusy && !actionBusy && onClose()}
      title={title}
    >
      <div className="space-y-5">
        {/* Offer summary (when editing) */}
        {offer && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-secondary">Details</h3>
            <div className="space-y-0.5">
              <KV label="Status" value={
                <Badge variant={offerStatusVariant(offer.status)} className="text-[11px]">
                  {offer.status}
                </Badge>
              } />
              <KV label="Offered CTC" value={offer.offered_ctc != null ? `₹ ${Number(offer.offered_ctc).toLocaleString('en-IN')}` : '-'} />
              <KV label="Joining date" value={fmtDate(offer.joining_date)} />
              <KV label="Released by" value={offer.released_by_username ?? '-'} />
              <KV label="Released at" value={fmtDate(offer.released_at)} />
              {offer.accepted_at ? <KV label="Accepted at" value={fmtDate(offer.accepted_at)} /> : null}
              {offer.declined_at ? <KV label="Declined at" value={fmtDate(offer.declined_at)} /> : null}
              {offer.notes ? <KV label="Notes" value={offer.notes} /> : null}
            </div>
          </section>
        )}

        {/* Create / Edit form */}
        {showEditForm && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-secondary">
              {isCreate ? 'New offer' : 'Edit offer'}
            </h3>
            <div className="space-y-3">
              {isCreate && !applicationId && (
                <Input
                  id="of_appid"
                  label="Application ID"
                  type="number"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="Enter hiring application ID"
                />
              )}
              {isCreate && applicationId && (
                <KV label="Application" value={`#${applicationId}`} />
              )}
              <Input
                id="of_ctc"
                label="Offered CTC (₹)"
                type="number"
                step="0.01"
                min="0.01"
                value={ctc}
                onChange={(e) => setCtc(e.target.value)}
                placeholder="e.g. 350000"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="of_join" className="text-sm font-medium text-app-secondary">
                  Joining date
                </label>
                <input
                  id="of_join"
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="of_notes" className="text-sm font-medium text-app-secondary">Notes</label>
                <textarea
                  id="of_notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes…"
                  className="min-h-[72px] rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                />
              </div>
              {saveError ? <p className="text-xs text-status-danger">{saveError}</p> : null}
              <Button
                type="button"
                className="w-full"
                disabled={saveBusy}
                onClick={() => void handleSave()}
              >
                {saveBusy ? 'Saving…' : isCreate ? 'Create offer' : 'Save changes'}
              </Button>
            </div>
          </section>
        )}

        {/* Lifecycle actions */}
        {offer && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-app-secondary">Actions</h3>

            {/* Release */}
            {isDraft && canRelease && (
              <div>
                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'release' ? null : 'release')}
                  className="text-xs text-brand-700 underline"
                >
                  Release offer
                </button>
                {activeAction === 'release' && (
                  <ActionPanel
                    label="Release"
                    busy={actionBusy}
                    error={actionErrors['release'] ?? null}
                    onConfirm={(note) => void doAction('release', note)}
                  />
                )}
              </div>
            )}

            {/* Accept */}
            {isReleased && canUpdate && (
              <div>
                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'accept' ? null : 'accept')}
                  className="text-xs text-status-hired underline"
                >
                  Accept offer
                </button>
                {activeAction === 'accept' && (
                  <ActionPanel
                    label="Accept"
                    busy={actionBusy}
                    error={actionErrors['accept'] ?? null}
                    onConfirm={(note) => void doAction('accept', note)}
                  />
                )}
              </div>
            )}

            {/* Decline */}
            {isReleased && canUpdate && (
              <div>
                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'decline' ? null : 'decline')}
                  className="text-xs text-status-danger underline"
                >
                  Decline offer
                </button>
                {activeAction === 'decline' && (
                  <ActionPanel
                    label="Decline"
                    variant="danger"
                    busy={actionBusy}
                    error={actionErrors['decline'] ?? null}
                    onConfirm={(note) => void doAction('decline', note)}
                  />
                )}
              </div>
            )}

            {/* Withdraw */}
            {(isDraft || isReleased || offer.status === 'accepted' || offer.status === 'declined') && canWithdrawExpire && (
              <div>
                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'withdraw' ? null : 'withdraw')}
                  className="text-xs text-status-attention underline"
                >
                  Withdraw offer
                </button>
                {activeAction === 'withdraw' && (
                  <ActionPanel
                    label="Withdraw"
                    variant="secondary"
                    busy={actionBusy}
                    error={actionErrors['withdraw'] ?? null}
                    onConfirm={(note) => void doAction('withdraw', note)}
                  />
                )}
              </div>
            )}

            {/* Expire */}
            {(isReleased || offer.status === 'accepted') && canWithdrawExpire && (
              <div>
                <button
                  type="button"
                  onClick={() => setActiveAction(activeAction === 'expire' ? null : 'expire')}
                  className="text-xs text-status-warning underline"
                >
                  Mark as expired
                </button>
                {activeAction === 'expire' && (
                  <ActionPanel
                    label="Mark expired"
                    variant="secondary"
                    busy={actionBusy}
                    error={actionErrors['expire'] ?? null}
                    onConfirm={(note) => void doAction('expire', note)}
                  />
                )}
              </div>
            )}

            {offer.status === 'withdrawn' || offer.status === 'expired' ? (
              <p className="text-xs text-app-subtle">No further actions available for this offer.</p>
            ) : null}
          </section>
        )}
      </div>
    </Drawer>
  )
}
