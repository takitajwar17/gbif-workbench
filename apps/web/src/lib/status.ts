import { formatNumber } from './format'
import type { DataPreview, Risk } from './types'

// Status enum + helpers for the global workflow state machine. Kept separate
// from React components so the lookup tables can be imported by any layer
// (e.g. workflow-progress badges, status cards) without pulling in JSX.

export type Status = 'idle' | 'interpreting' | 'previewing' | 'ready' | 'error'
export type StepState = 'done' | 'current' | 'pending'

const STATUS_DOT_MAP: Record<Status, string> = {
  idle: 'bg-muted-foreground/40',
  interpreting: 'bg-amber-500 animate-pulse',
  previewing: 'bg-amber-500 animate-pulse',
  ready: 'bg-emerald-500',
  error: 'bg-destructive',
}

export function statusText(status: Status, preview: DataPreview | null, topRisk?: Risk) {
  if (status === 'interpreting') return 'Reading your question…'
  if (status === 'previewing') return 'Querying GBIF and assessing risks…'
  if (status === 'error') return 'Analysis failed'
  if (status === 'ready' && topRisk && preview) {
    return `${formatNumber(preview.counts.withUsableCoordinates)} usable records · top risk: ${topRisk.title}`
  }
  if (status === 'ready' && preview) return `${formatNumber(preview.counts.withUsableCoordinates)} usable records · workflow ready`
  return 'Ready to analyze'
}

export function statusDotClass(status: Status) {
  return STATUS_DOT_MAP[status] ?? 'bg-muted-foreground/40'
}

export function stepStateClass(state: StepState) {
  if (state === 'done') return 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200'
  if (state === 'current') return 'bg-accent text-accent-foreground ring-1 ring-primary/30'
  return 'bg-background text-muted-foreground ring-1 ring-border'
}

export function stepStateLabel(state: StepState) {
  if (state === 'done') return 'Done'
  if (state === 'current') return 'Current'
  return 'Pending'
}