import { Progress } from '@/components/ui/progress'

export function Readiness({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">{value}</span>
      </div>
      <Progress value={value} />
    </div>
  )
}