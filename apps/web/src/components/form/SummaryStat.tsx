export function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block line-clamp-2 text-sm leading-5">{value}</strong>
    </div>
  )
}