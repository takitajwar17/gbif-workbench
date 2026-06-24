import { Check } from 'lucide-react'
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
  const steps: { label: string; description: string; state: StepState }[] = [
    { label: 'Question', description: 'Describe your study', state: question.trim() ? 'done' : 'current' },
    { label: 'Scope', description: 'Interpret the question', state: intent ? 'done' : question.trim() || status === 'interpreting' ? 'current' : 'pending' },
    { label: 'Preview', description: 'Fetch GBIF data', state: preview ? 'done' : intent || status === 'previewing' ? 'current' : 'pending' },
    { label: 'Export', description: 'Generate workflow', state: workflow ? 'done' : preview ? 'current' : 'pending' },
  ]

  const currentIndex = steps.findIndex((step) => step.state === 'current')

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
            <span className="grid size-6 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium">
              {step.state === 'done' ? <Check className="size-3.5" /> : index + 1}
            </span>
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