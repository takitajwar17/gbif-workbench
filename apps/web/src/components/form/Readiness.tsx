import { Progress } from '@/components/ui/progress'

function readinessTone(value: number): string {
  if (value >= 70) return 'text-emerald-700'
  if (value >= 40) return 'text-amber-700'
  return 'text-red-700'
}

function readinessLabel(value: number): string {
  if (value >= 80) return 'Strong'
  if (value >= 60) return 'Good'
  if (value >= 40) return 'Mixed'
  if (value >= 20) return 'Weak'
  return 'Very weak'
}

export function Readiness({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const tone = readinessTone(value)
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="flex items-baseline gap-1">
          <span className={`font-mono text-sm font-semibold ${tone}`}>{value}</span>
          <span className="text-xs text-muted-foreground">/100</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${tone}`}>· {readinessLabel(value)}</span>
        </span>
      </div>
      <Progress value={value} aria-label={`${label}: ${value} out of 100, ${readinessLabel(value)}`} />
      {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  )
}