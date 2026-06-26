import { memo, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, Database, Loader2, RefreshCw, Trash2, X } from 'lucide-react'
import { useAppAuth } from '@/auth/auth-context'
import {
  deleteHistoryEntry,
  requestHistoryEntry,
  requestHistoryList,
} from '@/components/api/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import type { HistoryListItem, HistorySnapshot } from '@/lib/types'

// Drawer width: generous enough to show a list with full question
// text, but never wider than the viewport on phones.
const DRAWER_WIDTH = 'min(420px, 100vw)'

// Hoisted to module scope: Intl.DateTimeFormat construction is
// non-trivial, and this formatter is used once per history row per
// render. Building it once at module load is significantly cheaper
// than allocating a fresh instance per row inside the component.
// See: js-cache-function-results in the Vercel React Best Practices.
const HISTORY_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

// HistoryButton renders a "History" button in the header that opens a
// full-height right-side drawer. The drawer is rendered into
// document.body via createPortal so its `position: fixed` children
// are NOT contained by any ancestor's `backdrop-filter` /
// `transform` / `filter` (the sticky header uses `backdrop-blur`,
// which creates a new containing block and would otherwise clip the
// drawer to the header's 64px height).
//
// Clicking a row fetches its full snapshot and hands it directly to
// the workspace via onRestore (wired to useAnalyze.loadHistorySnapshot
// in App.tsx) — no inline detail panel, no separate Restore button.
// The drawer closes as soon as the restore completes.
export function HistoryButton({ onRestore }: { onRestore: (snapshot: HistorySnapshot) => void }) {
  const auth = useAppAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<HistoryListItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [restoringId, setRestoringId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    if (!auth.isSignedIn) return
    setLoadingList(true)
    setError('')
    try {
      const nextItems = await requestHistoryList(auth.getAuthToken)
      setItems(nextItems)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load account history.')
    } finally {
      setLoadingList(false)
    }
  }, [auth.getAuthToken, auth.isSignedIn])

  const openHistory = () => {
    if (!auth.isConfigured) {
      setOpen(true)
      setError('Authentication is not configured. Add Clerk keys before using account history.')
      return
    }
    if (!auth.isLoaded) return
    if (!auth.isSignedIn) {
      auth.requestSignIn()
      return
    }
    setOpen(true)
    void loadList()
  }

  const closeHistory = useCallback(() => {
    setOpen(false)
  }, [])

  // Clicking a row fetches its full snapshot and hands it straight to
  // the workspace. While the fetch is in flight the row shows a
  // loading indicator and other rows are dimmed; the drawer closes
  // as soon as the snapshot lands.
  const restoreItem = useCallback(async (item: HistoryListItem) => {
    setRestoringId(item.id)
    setError('')
    try {
      const entry = await requestHistoryEntry(item.id, auth.getAuthToken)
      if (!entry?.snapshot) {
        setError('Saved analysis is missing its snapshot. Re-run the analysis.')
        return
      }
      onRestore(entry.snapshot)
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this history entry.')
    } finally {
      setRestoringId('')
    }
  }, [auth.getAuthToken, onRestore])

  const removeItem = useCallback(async (item: HistoryListItem) => {
    const confirmed = window.confirm(`Delete this saved analysis? This can't be undone.\n\n"${item.question}"`)
    if (!confirmed) return
    setDeletingId(item.id)
    setError('')
    try {
      await deleteHistoryEntry(item.id, auth.getAuthToken)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this history entry.')
    } finally {
      setDeletingId('')
    }
  }, [auth.getAuthToken])

  // Escape closes the drawer. Bound only while open so we don't
  // intercept keystrokes meant for the rest of the app.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHistory()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeHistory])

  // Lock body scroll while the drawer is open so background scrolling
  // doesn't fight with the drawer's own scroll container. Restore the
  // previous overflow on cleanup so we don't strand the page in a
  // no-scroll state if the component unmounts mid-open.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openHistory}
        title={auth.isSignedIn ? 'Open account history' : 'Sign in to view account history'}
      >
        <Clock3 />
        History
      </Button>

      {/* Drawer layer. Mounted into <body> via createPortal so the
          fixed-positioned drawer escapes the header's backdrop-filter
          containing block. Rendered conditionally so the slide-in
          animation plays on every open. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-label="Account history"
        >
          {/* Backdrop: dim the workspace underneath and intercept clicks
              so tapping outside the drawer closes it. */}
          <button
            type="button"
            aria-label="Close history"
            onClick={closeHistory}
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
          />

          {/* The drawer itself. Full-height, right-anchored, slides in. */}
          <div
            className="absolute inset-y-0 right-0 flex max-w-full flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-out"
            style={{ width: DRAWER_WIDTH }}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <h2 className="text-base font-semibold">Account history</h2>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Click an analysis to load it into the workspace.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void loadList()}
                  disabled={loadingList || !auth.isSignedIn}
                  aria-label="Refresh history"
                >
                  <RefreshCw className={loadingList ? 'animate-spin' : undefined} />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={closeHistory} aria-label="Close history">
                  <X />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>History unavailable</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {!auth.isSignedIn && !error && (
                  <Alert>
                    <AlertTitle>Sign in required</AlertTitle>
                    <AlertDescription>
                      Account history is saved per Clerk user. Sign in, then run an analysis to create your first entry.
                    </AlertDescription>
                  </Alert>
                )}

                {auth.isSignedIn && loadingList && items.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading saved analyses…
                  </div>
                )}

                {auth.isSignedIn && !loadingList && items.length === 0 && !error && (
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-medium">No saved analyses yet</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      Run an analysis while signed in. Completed workflow exports are saved automatically.
                    </p>
                  </div>
                )}

                {items.length > 0 && (
                  <ul className="grid gap-2" role="listbox" aria-label="Saved analyses">
                    {items.map((item) => (
                      <HistoryRow
                        key={item.id}
                        item={item}
                        isRestoring={restoringId === item.id}
                        isAnyRowBusy={restoringId !== ''}
                        isDeleting={deletingId === item.id}
                        onRestore={restoreItem}
                        onDelete={removeItem}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function formatHistoryDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved analysis'
  return HISTORY_DATE_FORMAT.format(date)
}

function humanize(value: string) {
  return value.replaceAll('_', ' ')
}

// HistoryRow is the per-item card in the history list. Wrapped in
// React.memo so that when one row enters the "restoring" state (or
// any other row's state changes), the other rows don't re-render.
// Props are primitives + stable callbacks — the parent computes the
// per-row booleans (isRestoring, isDeleting) so this component's
// memo check stays cheap.
//
// See: rerender-memo and rerender-derived-state in the Vercel React
// Best Practices.
interface HistoryRowProps {
  item: HistoryListItem
  isRestoring: boolean
  isAnyRowBusy: boolean
  isDeleting: boolean
  onRestore: (item: HistoryListItem) => void
  onDelete: (item: HistoryListItem) => void
}

const HistoryRow = memo(function HistoryRow({
  item,
  isRestoring,
  isAnyRowBusy,
  isDeleting,
  onRestore,
  onDelete,
}: HistoryRowProps) {
  return (
    <li>
      <article
        className={cn(
          'group relative rounded-lg border bg-card p-3 text-card-foreground transition-colors hover:border-primary hover:bg-primary/5',
          isRestoring && 'opacity-60',
        )}
      >
        {/* Whole-card click target: an absolutely-positioned <button>
            covers the entire card. Pointer events on the inner content
            are disabled (`pointer-events-none`) so clicks pass through
            to this overlay. The delete button re-enables pointer
            events and sits above the overlay in the stacking order so
            it remains interactive independently. */}
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer rounded-lg text-left"
          onClick={() => void onRestore(item)}
          disabled={isAnyRowBusy || isDeleting}
          aria-label={`Load saved analysis: ${item.question}`}
        />
        <div className="pointer-events-none relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-medium leading-5">{item.question}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {formatHistoryDate(item.createdAt)}
              {item.taxonName ? ` · ${item.taxonName}` : ''}
              {item.regionText ? ` · ${item.regionText}` : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void onDelete(item)}
            disabled={isDeleting || isAnyRowBusy}
            aria-label="Delete history entry"
            className="pointer-events-auto relative z-10 opacity-60 hover:opacity-100"
          >
            {isDeleting ? <RefreshCw className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
        <div className="pointer-events-none relative mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatNumber(item.recordCount)} records</Badge>
          {typeof item.readinessAverage === 'number' && (
            <Badge
              variant={
                item.readinessAverage >= 70
                  ? 'success'
                  : item.readinessAverage >= 40
                    ? 'warning'
                    : 'outline'
              }
            >
              {item.readinessAverage}% ready
            </Badge>
          )}
          {item.analysisType ? <Badge variant="outline">{humanize(item.analysisType)}</Badge> : null}
        </div>
        {isRestoring && (
          <p className="pointer-events-none relative mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Loading saved workflow…
          </p>
        )}
      </article>
    </li>
  )
})