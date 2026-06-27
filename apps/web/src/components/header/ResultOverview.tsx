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
  const nextStep = triage.nextSteps[0] ?? (workflow ? 'Open the Exports tab and copy the generated code.' : 'Review the generated workflow below.')

  return (
    <Card className="min-w-0 2xl:col-span-2">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Occurrence data fit</h2>
            {topRisk && <Badge variant={riskBadgeVariant(topRisk.level)}>{topRisk.level}</Badge>}
          </div>
          {workflow && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href="#exports">
                Go to exports <ArrowRight />
              </a>
            </Button>
          )}
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:items-start">
          <div className="min-w-0 space-y-2">
            <p className="text-sm leading-6 text-muted-foreground">{triage.support.headline}</p>
            {topRisk && (
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Top risk:</span> {topRisk.title}
              </p>
            )}
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">Suggested next step:</span> {nextStep}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <SummaryStat label="Usable coordinates" value={formatNumber(preview.counts.withUsableCoordinates)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
