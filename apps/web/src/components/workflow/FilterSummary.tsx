import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatFilterName, formatFilterValue } from '@/lib/format'
import type { GbifQuery } from '@/lib/types'

export function FilterSummary({ query, recommendedFilters }: { query: GbifQuery; recommendedFilters: string[] }) {
  const apiFilters = Object.entries(query.apiParams)
  return (
    <Card className="bg-muted/35">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-sm">Filters applied to GBIF</strong>
            <span className="text-xs text-muted-foreground">{apiFilters.length} parameter{apiFilters.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {apiFilters.map(([key, value]) => (
              <Badge key={key} variant="secondary">
                {formatFilterName(key)}: {formatFilterValue(value)}
              </Badge>
            ))}
          </div>
        </div>
        {recommendedFilters.length > 0 && (
          <div>
            <strong className="text-sm">Recommended additional filters</strong>
            <p className="mt-1 text-xs text-muted-foreground">The Workbench suggests these to reduce noise and bias in your dataset.</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
              {recommendedFilters.map((filter) => (
                <li key={filter}>{filter}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}