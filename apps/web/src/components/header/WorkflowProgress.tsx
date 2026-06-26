import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { stepStateClass, stepStateLabel } from '@/lib/status'
import type { Status, StepState } from '@/lib/status'
import type { DataPreview, StudyIntent, WorkflowPackage } from '@/lib/types'

export function WorkflowProgress({
  status,
  question,
  intent,
  preview,
  workflow,
}: {
  status: Status
  question: string
  intent: StudyIntent | null
  preview: DataPreview | null
  workflow: WorkflowPackage | null
}) {
  // Derive a 'loading' state for whichever step is currently in flight.
  // Scope is loading while we're interpreting the question, Preview while
  // we're fetching GBIF data. Question and Export have no async phase of
  // their own so they never enter 'loading'.
  const steps: { label: string; description: string; state: StepState }[] = [
    { label: 'Question', description: 'Describe your study', state: question.trim() ? 'done' : 'current' },
    {
      label: 'Scope',
      description: 'Interpret the question',
      state: status === 'interpreting' && question.trim() && !intent
        ? 'loading'
        : intent
          ? 'done'
          : question.trim() || status === 'interpreting'
            ? 'current'
            : 'pending',
    },
    {
      label: 'Preview',
      description: 'Fetch GBIF data',
      state: status === 'previewing' && intent && !preview
        ? 'loading'
        : preview
          ? 'done'
          : intent || status === 'previewing'
            ? 'current'
            : 'pending',
    },
    {
      label: 'Export',
      description: 'Generate workflow',
      // 'loading' while /api/workflow is in flight so the badge spins.
      // 'current' before the workflow call starts (we have a preview
      // but no workflow yet). 'done' once the workflow lands.
      state: workflow
        ? 'done'
        : status === 'generating'
          ? 'loading'
          : preview
            ? 'current'
            : 'pending',
    },
  ]

  const currentIndex = steps.findIndex((step) => step.state === 'current' || step.state === 'loading')

  return (
    <div className="rounded-lg border bg-card p-3" aria-label="Workflow progress">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Workflow progress</p>
        {currentIndex >= 0 && (
          <p className="text-xs text-muted-foreground">
            Step {currentIndex + 1} of {steps.length}
          </p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${stepStateClass(step.state)}`}>
            <StepBadge state={step.state} index={index} label={step.label} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{step.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{step.description}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="sr-only">{stepStateLabel(steps[currentIndex]?.state ?? 'pending')}</p>
    </div>
  )
}

// Numbered circle badge for one step. When the step is 'loading', swap
// the digit for a spinning Loader2 icon. The circle outline (border +
// size-6 rounded-full) stays intact, so the spinner sits inside the
// ring — same visual footprint as the static number.
function StepBadge({ state, index, label }: { state: StepState; index: number; label: string }) {
  const isLoading = state === 'loading'
  const isDone = state === 'done'
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium ${
        isLoading ? 'border-primary/60 text-primary' : ''
      }`}
      aria-label={`Step ${index + 1} ${label}${isLoading ? ' (loading)' : isDone ? ' (done)' : ''}`}
    >
      {isLoading ? (
        <Spinner className="size-3.5" aria-hidden="true" />
      ) : isDone ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        index + 1
      )}
    </span>
  )
}