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
  const steps: { label: string; state: StepState }[] = [
    { label: 'Question', state: question.trim() ? 'done' : 'current' },
    { label: 'Scope', state: intent ? 'done' : question.trim() || status === 'interpreting' ? 'current' : 'pending' },
    { label: 'Preview', state: preview ? 'done' : intent || status === 'previewing' ? 'current' : 'pending' },
    { label: 'Export', state: workflow ? 'done' : preview ? 'current' : 'pending' },
  ]

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-2 sm:grid-cols-4 lg:col-span-2" aria-label="Workflow progress">
      {steps.map((step, index) => (
        <div key={step.label} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${stepStateClass(step.state)}`}>
          <span className="grid size-6 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium">
            {step.state === 'done' ? <Check className="size-3.5" /> : index + 1}
          </span>
          <span className="min-w-0 truncate font-medium">{step.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">{stepStateLabel(step.state)}</span>
        </div>
      ))}
    </div>
  )
}