import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SummaryStat } from '@/components/form/SummaryStat'
import { formatNumber } from '@/lib/format'
import { riskBadgeVariant, riskWeight } from '@/lib/risk'
import type { DataPreview, TriageResult, WorkflowPackage } from '@/lib/types'

export function ResultOverview({ preview, triage, workflow }: { preview: DataPreview | null; triage: TriageResult | null; workflow: WorkflowPackage | null }) {
  if (!preview || !triage) return null
  const topRisk = triage.risks.toSorted((a, b) => riskWeight(b.level) - riskWeight(a.level))[0]
  const readinessAverage = Math.round((triage.readiness.spatial + triage.readiness.temporal + triage.readiness.taxonomic + triage.readiness.dataType) / 4)
  const nextStep = triage.nextSteps[0] ?? (workflow ? 'Open the Exports tab and copy the generated code.' : 'Review the generated workflow below.')

  return (
    <Card className="min-w-0 2xl:col-span-2">
      <CardContent className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">What GBIF Workbench found</h2>
            {topRisk && <Badge variant={riskBadgeVariant(topRisk.level)}>{topRisk.level}</Badge>}
            {workflow && <Badge variant="success">Exports ready</Badge>}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{triage.support.headline}</p>
          {topRisk && <p className="mt-1 text-sm leading-6 text-muted-foreground">Top risk: {topRisk.title}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <SummaryStat label="Usable records" value={formatNumber(preview.counts.withUsableCoordinates)} />
          <SummaryStat label="Average readiness" value={`${readinessAverage}/100`} detail={readinessAverage >= 70 ? 'Strong' : readinessAverage >= 40 ? 'Mixed' : 'Weak'} />
          <SummaryStat label="Suggested next step" value={nextStep} />
        </div>
        {workflow && (
          <div className="xl:col-span-2 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href="#exports">
                Go to exports <ArrowRight />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}