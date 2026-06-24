import { Card, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import { statusDotClass, statusText } from '@/lib/status'
import type { Status } from '@/lib/status'
import type { DataPreview, Risk } from '@/lib/types'

export function StatusCard({ status, preview, topRisk }: { status: Status; preview: DataPreview | null; topRisk?: Risk }) {
  return (
    <Card className="self-end" role="status" aria-live="polite">
      <CardContent className="flex items-start gap-3 p-4">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${statusDotClass(status)}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{statusText(status, preview, topRisk)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {status === 'ready' && preview ? `${formatNumber(preview.counts.total)} matching records in the current preview.` : 'Live GBIF previews are generated only after analysis runs.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}