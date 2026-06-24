export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold tracking-normal">{value}</strong>
      {detail && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>}
    </div>
  )
}