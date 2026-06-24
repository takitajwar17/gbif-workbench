import type { DataPreview, Risk } from './types'

// Status enum + helpers for the global workflow state machine. Kept separate
// from React components so the lookup tables can be imported by any layer
// (e.g. workflow-progress badges, status cards) without pulling in JSX.

export type Status = 'idle' | 'interpreting' | 'previewing' | 'ready' | 'error'
export type StepState = 'done' | 'current' | 'pending'

const STATUS_DOT_MAP: Record<Status, string> = {
  idle: 'bg-muted-foreground',
  interpreting: 'bg-amber-500',
  previewing: 'bg-amber-500',
  ready: 'bg-primary',
  error: 'bg-destructive',
}

export function statusText(status: Status, preview: DataPreview | null, topRisk?: Risk) {
  if (status === 'interpreting') return 'Interpreting study scope'
  if (status === 'previewing') return 'Running OpenAI and GBIF analysis'
  if (status === 'error') return 'Analysis failed'
  if (status === 'ready' && topRisk) return `${preview?.counts.withUsableCoordinates.toLocaleString()} usable records · ${topRisk.level.toLowerCase()} ${topRisk.title.toLowerCase()}`
  if (status === 'ready' && preview) return `${preview.counts.withUsableCoordinates.toLocaleString()} usable records · workflow ready`
  return 'Ready to analyze'
}

export function statusDotClass(status: Status) {
  return STATUS_DOT_MAP[status] ?? 'bg-muted-foreground'
}

export function stepStateClass(state: StepState) {
  if (state === 'done') return 'bg-emerald-50 text-emerald-950'
  if (state === 'current') return 'bg-accent text-accent-foreground'
  return 'bg-background text-muted-foreground'
}

export function stepStateLabel(state: StepState) {
  if (state === 'done') return 'Done'
  if (state === 'current') return 'Current'
  return 'Pending'
}