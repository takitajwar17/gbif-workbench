import { Card, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import { statusDotClass, statusText } from '@/lib/status'
import type { Status } from '@/lib/status'
import type { DataPreview, Risk } from '@/lib/types'

export function StatusCard({ status, preview, topRisk }: { status: Status; preview: DataPreview | null; topRisk?: Risk }) {
  return (
    <Card className="self-end" role="status" aria-live="polite">
      <CardContent className="flex items-start gap-3 p-4">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-background ${statusDotClass(status)}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{statusText(status, preview, topRisk)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {status === 'ready' && preview
              ? `${formatNumber(preview.counts.total)} matching records in the current preview.`
              : status === 'interpreting'
                ? 'Reading your question and extracting scope. This usually takes 3–8 seconds.'
                : status === 'previewing'
                  ? 'Querying GBIF and classifying risks. May take 5–15 seconds the first time GBIF is hit.'
                  : status === 'generating'
                    ? 'Assessment is ready above. The reproducible workflow streams in behind it — usually 5–15 seconds.'
                    : status === 'error'
                      ? 'Something went wrong. Try the retry button below the error message.'
                      : 'Occurrence-search previews are generated only after assessment runs.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
