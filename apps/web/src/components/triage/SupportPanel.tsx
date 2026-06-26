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

function deriveSupportBadge(triage: TriageResult): { label: string; variant: 'success' | 'warning' | 'destructive' } {
  const bad = triage.support.notSupportedWithOccurrenceOnly.length + triage.support.insufficientData.length
  const caution = triage.support.conditionallySupported.length + triage.support.exploratoryOnly.length
  const good = triage.support.stronglySupported.length
  if (bad > 0) return { label: 'Limited support', variant: 'destructive' }
  if (good > 0 && caution === 0) return { label: 'Strongly supported', variant: 'success' }
  return { label: 'Scope dependent', variant: 'warning' }
}

export function SupportPanel({ triage }: { triage: TriageResult }) {
  const badge = deriveSupportBadge(triage)
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Can GBIF support this study?</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <h2 className="text-xl font-semibold leading-tight">{triage.support.headline}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Readiness label="Spatial coverage" value={triage.readiness.spatial} hint="Geographic extent of available records" />
        <Readiness label="Temporal coverage" value={triage.readiness.temporal} hint="How well the time window is sampled" />
        <Readiness label="Taxonomic coverage" value={triage.readiness.taxonomic} hint="Confidence in the GBIF taxon match" />
        <Readiness label="Data type fit" value={triage.readiness.dataType} hint="Whether GBIF occurrence data fits the analysis" />
      </div>

      <div className="space-y-3">
        <SupportGroup title="What GBIF can answer directly" items={triage.support.stronglySupported} tone="good" />
        <SupportGroup title="Conditionally supported" items={triage.support.conditionallySupported} tone="caution" />
        <SupportGroup title="Exploratory only" items={triage.support.exploratoryOnly} tone="caution" />
        <SupportGroup title="Not supported by occurrence-only data" items={triage.support.notSupportedWithOccurrenceOnly} tone="danger" />
        <SupportGroup title="Insufficient data" items={triage.support.insufficientData} tone="danger" />
        <SupportGroup title="Unsupported claims" items={triage.unsupportedClaims} tone="danger" />
        <SupportGroup title="Suggested next steps" items={triage.nextSteps} tone="good" />
      </div>
    </section>
  )
}