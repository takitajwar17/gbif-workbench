import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RiskDetail } from '@/components/form/RiskDetail'
import { riskBadgeVariant, riskToneClass } from '@/lib/risk'
import type { Risk } from '@/lib/types'

export function RiskCard({ risk, defaultOpen }: { risk: Risk; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className={`group rounded-lg border p-4 ${riskToneClass(risk.level)} [&_summary::-webkit-details-marker]:hidden [&_summary]:list-none`}>
      <summary className="cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold leading-5">{risk.title}</h3>
          <Badge variant={riskBadgeVariant(risk.level)}>{risk.level}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{risk.explanation}</p>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
          <span className="group-open:hidden">Show evidence and mitigation</span>
          <span className="hidden group-open:inline">Hide evidence and mitigation</span>
        </div>
      </summary>
      <dl className="mt-3 space-y-2 border-t pt-3 text-sm">
        <RiskDetail title="Evidence" body={risk.evidence} />
        <RiskDetail title="Why it matters" body={risk.whyItMatters} />
        <RiskDetail title="Mitigation" body={risk.recommendedMitigation} />
        {risk.relatedWorkflowStep && <RiskDetail title="Workflow step" body={risk.relatedWorkflowStep} />}
      </dl>
    </details>
  )
}