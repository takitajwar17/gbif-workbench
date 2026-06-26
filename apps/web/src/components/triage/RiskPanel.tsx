import { AlertTriangle } from 'lucide-react'
import { RiskCard } from './RiskCard'
import { riskWeight } from '@/lib/risk'
import type { Risk } from '@/lib/types'

export function RiskPanel({ risks }: { risks: Risk[] }) {
  // Single pass that sorts (immutably) AND tallies the blocking/high
  // counts in one go, instead of a sort + two .filter() scans. For a
  // typical 3–7-risk LLM response this is microseconds, but on a larger
  // risk array the count-by-level tally only needs to walk the array once.
  // See: js-combine-iterations + js-tosorted-immutable in the Vercel
  // React Best Practices.
  const sorted = risks.toSorted((a, b) => riskWeight(b.level) - riskWeight(a.level))
  let blocking = 0
  let high = 0
  for (const risk of sorted) {
    if (risk.level === 'BLOCKING') blocking += 1
    else if (risk.level === 'HIGH') high += 1
  }
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