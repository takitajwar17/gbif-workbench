export function SummaryStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block line-clamp-2 text-sm leading-5">{value}</strong>
      {detail && <span className="mt-0.5 block text-[11px] text-muted-foreground">{detail}</span>}
    </div>
  )
}