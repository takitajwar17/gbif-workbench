import { useCallback, useMemo, useState } from 'react'
import { Clock3, Database, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react'
import { useAppAuth } from '@/auth/auth-context'
import {
  deleteHistoryEntry,
  requestHistoryEntry,
  requestHistoryList,
} from '@/components/api/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import type { HistoryEntry, HistoryListItem, HistorySnapshot } from '@/lib/types'

export function HistoryButton({ onRestore }: { onRestore: (snapshot: HistorySnapshot) => void }) {
  const auth = useAppAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<HistoryListItem[]>([])
  const [selected, setSelected] = useState<HistoryEntry | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingEntryId, setLoadingEntryId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    if (!auth.isSignedIn) return
    setLoadingList(true)
    setError('')
    try {
      const nextItems = await requestHistoryList(auth.getAuthToken)
      setItems(nextItems)
      setSelected((current) =>
        current && !nextItems.some((item) => item.id === current.id) ? null : current,
      )
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

  const selectItem = async (item: HistoryListItem) => {
    setLoadingEntryId(item.id)
    setError('')
    try {
      const entry = await requestHistoryEntry(item.id, auth.getAuthToken)
      setSelected(entry)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this history entry.')
    } finally {
      setLoadingEntryId('')
    }
  }

  const restoreSelected = () => {
    if (!selected?.snapshot) return
    onRestore(selected.snapshot)
    setOpen(false)
  }

  const removeItem = async (item: HistoryListItem) => {
    setDeletingId(item.id)
    setError('')
    try {
      await deleteHistoryEntry(item.id, auth.getAuthToken)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      if (selected?.id === item.id) setSelected(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this history entry.')
    } finally {
      setDeletingId('')
    }
  }

  const selectedSummary = useMemo(() => {
    if (!selected) return null
    return [
      selected.taxonName,
      selected.regionText,
      selected.countries.length ? selected.countries.join(', ') : '',
    ].filter(Boolean).join(' · ')
  }, [selected])

  return (
    <div className="relative">
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

      {open && (
        <aside
          role="dialog"
          aria-label="Account history"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex max-h-[min(620px,calc(100vh-5rem))] w-[min(440px,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <h2 className="text-base font-semibold">Account history</h2>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Saved analyses from your signed-in account.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => void loadList()} disabled={loadingList || !auth.isSignedIn} aria-label="Refresh history">
                  <RefreshCw className={loadingList ? 'animate-spin' : undefined} />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close history">
                  <X />
                </Button>
              </div>
            </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-4 p-4">
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
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading saved analyses…</div>
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
                    <div className="grid gap-2">
                      {items.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-lg border bg-card p-3 text-card-foreground"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => void selectItem(item)}
                            >
                              <h3 className="line-clamp-2 text-sm font-medium leading-5">{item.question}</h3>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {formatHistoryDate(item.createdAt)}
                                {item.taxonName ? ` · ${item.taxonName}` : ''}
                                {item.regionText ? ` · ${item.regionText}` : ''}
                              </p>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => void removeItem(item)}
                              disabled={deletingId === item.id}
                              aria-label="Delete history entry"
                            >
                              {deletingId === item.id ? <RefreshCw className="animate-spin" /> : <Trash2 />}
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{formatNumber(item.recordCount)} records</Badge>
                            {typeof item.readinessAverage === 'number' && (
                              <Badge variant={item.readinessAverage >= 70 ? 'success' : item.readinessAverage >= 40 ? 'warning' : 'outline'}>
                                {item.readinessAverage}% ready
                              </Badge>
                            )}
                            {item.analysisType && <Badge variant="outline">{humanize(item.analysisType)}</Badge>}
                          </div>
                          {selected?.id === item.id && (
                            <div className="mt-3 rounded-md border bg-muted/30 p-3">
                              <p className="text-sm font-medium">{selected.supportHeadline || 'Saved workflow ready'}</p>
                              {selectedSummary && (
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedSummary}</p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button type="button" size="sm" onClick={restoreSelected}>
                                  <RotateCcw />
                                  Restore
                                </Button>
                              </div>
                            </div>
                          )}
                          {loadingEntryId === item.id && (
                            <p className="mt-3 text-xs text-muted-foreground">Loading saved workflow…</p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
          </div>
        </aside>
      )}
    </div>
  )
}

function formatHistoryDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved analysis'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function humanize(value: string) {
  return value.replaceAll('_', ' ')
}
