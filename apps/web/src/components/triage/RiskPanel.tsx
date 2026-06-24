import { AlertTriangle } from 'lucide-react'
import { RiskCard } from './RiskCard'
import { riskWeight } from '@/lib/risk'
import type { Risk } from '@/lib/types'

export function RiskPanel({ risks }: { risks: Risk[] }) {
  const sorted = [...risks].sort((a, b) => riskWeight(b.level) - riskWeight(a.level))
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4 text-amber-700" />
        Bias and limitation checks
      </div>
      <div className="space-y-3">
        {sorted.map((risk, index) => (
          <RiskCard key={`${risk.category}-${risk.title}`} risk={risk} defaultOpen={index < 2} />
        ))}
      </div>
    </section>
  )
}