import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function MethodSection() {
  return (
    <Card id="method" className="2xl:col-span-2">
      <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,420px)]">
        <div>
          <h2 className="text-lg font-semibold">Scientific guardrail</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            GBIF Workbench does not certify data as valid. It summarizes GBIF-mediated data availability and common data-use risks for a proposed research question. Final suitability depends on method choice, taxon expertise, scale, and additional data sources.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Badge variant="outline" className="justify-start py-1.5">
            OpenAI structured outputs
          </Badge>
          <Badge variant="outline" className="justify-start py-1.5">
            Official GBIF identifiers
          </Badge>
          <Badge variant="outline" className="justify-start py-1.5">
            DOI-backed download guidance
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}