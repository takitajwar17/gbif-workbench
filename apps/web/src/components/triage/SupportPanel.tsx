import { Badge } from '@/components/ui/badge'
import { Readiness } from '@/components/form/Readiness'
import { supportToneClass } from '@/lib/risk'
import type { TriageResult } from '@/lib/types'

function SupportGroup({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'caution' | 'danger' }) {
  if (!items.length) return null
  return (
    <div className={`rounded-lg border p-3 ${supportToneClass(tone)}`}>
      <strong className="text-sm">{title}</strong>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function SupportPanel({ triage }: { triage: TriageResult }) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Can GBIF support this study?</span>
          <Badge variant="outline">Scope dependent</Badge>
        </div>
        <h2 className="text-xl font-semibold leading-tight">{triage.support.headline}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Readiness label="Spatial" value={triage.readiness.spatial} />
        <Readiness label="Temporal" value={triage.readiness.temporal} />
        <Readiness label="Taxonomic" value={triage.readiness.taxonomic} />
        <Readiness label="Data type" value={triage.readiness.dataType} />
      </div>

      <div className="space-y-3">
        <SupportGroup title="Strongly supported" items={triage.support.stronglySupported} tone="good" />
        <SupportGroup title="Conditionally supported" items={triage.support.conditionallySupported} tone="caution" />
        <SupportGroup title="Exploratory only" items={triage.support.exploratoryOnly} tone="caution" />
        <SupportGroup title="Not supported by occurrence-only data" items={triage.support.notSupportedWithOccurrenceOnly} tone="danger" />
        <SupportGroup title="Insufficient data" items={triage.support.insufficientData} tone="danger" />
        <SupportGroup title="Unsupported claims" items={triage.unsupportedClaims} tone="danger" />
        <SupportGroup title="What to do next" items={triage.nextSteps} tone="good" />
      </div>
    </section>
  )
}