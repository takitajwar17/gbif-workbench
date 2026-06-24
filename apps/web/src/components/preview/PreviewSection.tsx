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
        <SectionTitle icon={<Database />} title="GBIF data preview" description="Aggregated search facets from the current scope." />
      </CardHeader>
      <CardContent>{preview ? <PreviewPanel preview={preview} /> : <EmptyState title="No live preview yet" body="Run a study idea to fetch GBIF counts, facets, issue flags, and sample records." />}</CardContent>
    </Card>
  )
}