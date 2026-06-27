import { AlertCircle, Loader2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

// Placeholder rendered in place of <WorkflowPanel /> while /api/workflow
// is in flight. Lives next to the support + risk panels so the user
// sees the assessment immediately and the workflow streams in behind
// it. When `error` is set, we render an inline error card so the user
// knows the export failed without losing the rest of the result card.
export function WorkflowLoadingPanel({ error }: { error?: string }) {
  if (error) {
    const needsRerun = error.startsWith('Scope changed')
    return (
      <section
        aria-label="Workflow generation error"
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              {needsRerun ? 'Workflow export needs re-run' : 'Workflow export unavailable'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {needsRerun ? error : `${error} Re-run the analysis to retry. The rest of the result card stays usable.`}
            </p>
          </div>
        </div>
      </section>
    )
  }
  return (
    <section
      aria-label="Workflow generating"
      aria-live="polite"
      className="rounded-lg border bg-card p-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Spinner className="size-4" aria-hidden="true" />
        Generating workflow…
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        The assessment above is ready. The reproducible R / Python / SQL workflow is being
        generated in the background and will appear here in a few seconds.
      </p>
      {/* Visual skeleton hint — three rows of pulsing bars so the user sees
          that something is loading instead of an empty white panel. */}
      <div className="mt-3 space-y-2" aria-hidden="true">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin opacity-60" />
          <span>Compiling occurrence download predicate and code links</span>
        </div>
        <div className="h-2 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-2 w-9/12 animate-pulse rounded bg-muted" />
        <div className="h-2 w-10/12 animate-pulse rounded bg-muted" />
      </div>
    </section>
  )
}
