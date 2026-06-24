import { formatNumber } from '@/lib/format'
import type { CountBucket } from '@/lib/types'

export function Histogram({ title, buckets, axisLabel }: { title: string; buckets: CountBucket[]; axisLabel?: string }) {
  const visible = buckets.slice(-28)
  const max = Math.max(1, ...visible.map((bucket) => bucket.count))
  const firstLabel = visible[0]?.name ?? 'n/a'
  const lastLabel = visible.at(-1)?.name ?? 'n/a'
  const rangeLabel = visible.length > 1 ? `${firstLabel} – ${lastLabel}` : firstLabel
  const axisText = axisLabel ? `${axisLabel}: ${rangeLabel}` : rangeLabel
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 flex h-36 items-end gap-1 border-b pb-2" aria-label={`Bar chart of ${title}`} role="img">
        {visible.map((bucket) => (
          <span
            key={bucket.name}
            className="min-w-0 flex-1 rounded-t bg-primary"
            title={`${bucket.name}: ${formatNumber(bucket.count)}`}
            aria-label={`${bucket.name}: ${formatNumber(bucket.count)} records`}
            style={{ height: `${Math.max(5, (bucket.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <small className="mt-2 block text-xs text-muted-foreground">{axisText}</small>
    </section>
  )
}

export function BarList({
  title,
  buckets,
  formatter = (value: string) => value,
  emptyText = 'No facet values returned.',
}: {
  title: string
  buckets: CountBucket[]
  formatter?: (value: string) => string
  emptyText?: string
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count))
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {buckets.length ? (
          buckets.map((bucket) => (
            <div key={bucket.name} className="grid grid-cols-[minmax(76px,1.2fr)_minmax(70px,1fr)_auto] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground" title={formatter(bucket.name)}>
                {formatter(bucket.name)}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (bucket.count / max) * 100)}%` }} />
              </div>
              <span className="font-mono text-muted-foreground">{formatNumber(bucket.count)}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </section>
  )
}

export function InfoBox({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-accent/45 p-4 text-sm">
      <strong>{title}</strong>
      <p className="mt-2 leading-6">{body}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}