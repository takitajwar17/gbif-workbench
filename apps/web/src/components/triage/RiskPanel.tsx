import { AlertTriangle } from 'lucide-react'
import { RiskCard } from './RiskCard'
import { riskWeight } from '@/lib/risk'
import type { Risk } from '@/lib/types'

export function RiskPanel({ risks }: { risks: Risk[] }) {
  const sorted = [...risks].sort((a, b) => riskWeight(b.level) - riskWeight(a.level))
  const blocking = sorted.filter((risk) => risk.level === 'BLOCKING').length
  const high = sorted.filter((risk) => risk.level === 'HIGH').length
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="size-4 text-amber-700" aria-hidden="true" />
          Bias and limitation checks
        </div>
        <p className="text-xs text-muted-foreground">
          {sorted.length} total
          {blocking > 0 ? ` · ${blocking} blocking` : ''}
          {high > 0 ? ` · ${high} high` : ''}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Top risks are expanded. Click any card to see evidence and mitigation.</p>
      <div className="space-y-3">
        {sorted.map((risk, index) => (
          <RiskCard key={`${risk.category}-${risk.title}`} risk={risk} defaultOpen={index < 2} />
        ))}
      </div>
    </section>
  )
}