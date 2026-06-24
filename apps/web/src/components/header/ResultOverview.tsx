import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SummaryStat } from '@/components/form/SummaryStat'
import { formatNumber } from '@/lib/format'
import { riskBadgeVariant, riskWeight } from '@/lib/risk'
import type { DataPreview, TriageResult, WorkflowPackage } from '@/lib/types'

export function ResultOverview({ preview, triage, workflow }: { preview: DataPreview | null; triage: TriageResult | null; workflow: WorkflowPackage | null }) {
  if (!preview || !triage) return null
  const topRisk = triage.risks.toSorted((a, b) => riskWeight(b.level) - riskWeight(a.level))[0]
  const readinessAverage = Math.round((triage.readiness.spatial + triage.readiness.temporal + triage.readiness.taxonomic + triage.readiness.dataType) / 4)

  return (
    <Card className="min-w-0 2xl:col-span-2">
      <CardContent className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Decision summary</h2>
            {topRisk && <Badge variant={riskBadgeVariant(topRisk.level)}>{topRisk.level}</Badge>}
            {workflow && <Badge variant="success">Exports ready</Badge>}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{triage.support.headline}</p>
          {topRisk && <p className="mt-1 text-sm leading-6 text-muted-foreground">Top risk: {topRisk.title}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <SummaryStat label="Usable records" value={formatNumber(preview.counts.withUsableCoordinates)} />
          <SummaryStat label="Readiness" value={`${readinessAverage}/100`} />
          <SummaryStat label="Next step" value={triage.nextSteps[0] ?? 'Review generated workflow'} />
        </div>
      </CardContent>
    </Card>
  )
}