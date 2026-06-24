import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function MethodSection() {
  return (
    <Card id="method" className="2xl:col-span-2">
      <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,420px)]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">How this fits into your research</h2>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            GBIF Workbench summarizes what GBIF can tell you about a question — counts, facets, sample coverage, common data-use risks — so you can decide whether a full download is worth it. It does <strong>not</strong> certify data quality or replace your own methods review. Final suitability depends on the taxon, scale, time window, and any extra datasets you bring in.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Badge variant="outline" className="justify-start py-1.5">
            Structured outputs from OpenAI
          </Badge>
          <Badge variant="outline" className="justify-start py-1.5">
            GBIF taxon keys and dataset metadata
          </Badge>
          <Badge variant="outline" className="justify-start py-1.5">
            Citation-ready methods and limitations text
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}