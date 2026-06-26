import { Database } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/layout/EmptyState'
import { SectionTitle } from '@/components/layout/SectionTitle'
import { PreviewPanel } from './PreviewPanel'
import type { DataPreview } from '@/lib/types'

export function PreviewSection({ preview }: { preview: DataPreview | null }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <SectionTitle icon={<Database />} title="Live data preview" description="Aggregated counts, sample points, and category breakdowns from GBIF for your current scope." />
      </CardHeader>
      <CardContent>
        {preview ? (
          <PreviewPanel preview={preview} />
        ) : (
          <EmptyState
            title="Awaiting live preview"
            body="Run a study idea to fetch GBIF counts, sample points, issue flags, and coordinate uncertainty. The preview updates whenever you rerun the scope."
          />
        )}
      </CardContent>
    </Card>
  )
}