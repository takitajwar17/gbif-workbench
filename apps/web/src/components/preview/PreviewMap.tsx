import { useMemo } from 'react'
import { Info, Map } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  GLOBAL_MAP_HEIGHT,
  GLOBAL_MAP_WIDTH,
  ZOOM_MAP_HEIGHT,
  ZOOM_MAP_WIDTH,
  createGlobalMapData,
  createZoomMapData,
  formatCoordinate,
  summarizeSpatialPreview,
} from '@/lib/previewMap'
import type { DataPreview } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { EmptyState } from '@/components/layout/EmptyState'

export function PreviewMap({ preview }: { preview: DataPreview }) {
  const summary = useMemo(() => summarizeSpatialPreview(preview), [preview])
  const zoomMap = useMemo(() => (summary ? createZoomMapData(summary) : null), [summary])
  const globalMap = useMemo(() => (summary ? createGlobalMapData(summary) : null), [summary])

  if (!summary || !zoomMap || !globalMap) {
    return <EmptyState title="No sample points returned" body="GBIF counts completed, but the sample-record request did not return plottable coordinates. The full download may still be usable." />
  }

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Spatial coverage preview">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Map className="size-4 text-primary" aria-hidden="true" />
            Spatial coverage check
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{summary.interpretation}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Info className="mr-1 inline size-3" aria-hidden="true" />
            The map uses country outlines and the live preview sample, not the full download.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <Badge variant={summary.isConcentrated ? 'warning' : 'success'}>{summary.isConcentrated ? 'Concentrated sample' : 'Broad sample'}</Badge>
          <p className="text-xs text-muted-foreground">
            {summary.isConcentrated ? 'Most points fall in a small region — fine-scale questions are well supported.' : 'Points span multiple regions — broad-scale questions are well supported.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border bg-muted/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{formatCoordinate(summary.extent.maxLat, 'lat')}</span>
            <span>Map view, zoomed to sample extent</span>
          </div>
          <svg className="block aspect-[16/9] w-full rounded-md bg-background" viewBox={`0 0 ${ZOOM_MAP_WIDTH} ${ZOOM_MAP_HEIGHT}`} role="img" aria-label={`${summary.points.length} sampled occurrence points plotted on a geographic map`}>
            <rect x="0" y="0" width={ZOOM_MAP_WIDTH} height={ZOOM_MAP_HEIGHT} rx="12" className="fill-background" />
            {zoomMap.countryPaths.map((path) => (
              <path key={path.key} d={path.d} className="fill-muted stroke-border" strokeWidth="1.2" />
            ))}
            {zoomMap.graticulePath && <path d={zoomMap.graticulePath} fill="none" className="stroke-border opacity-70" strokeWidth="0.8" />}
            {zoomMap.points.map((point, index) => (
              <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={point.hasHighUncertainty ? 8 : 6} className={point.hasHighUncertainty ? 'fill-amber-600 opacity-85' : 'fill-primary opacity-85'}>
                <title>
                  {point.hasHighUncertainty ? 'High coordinate uncertainty (>10 km)' : 'Sample occurrence'}
                </title>
              </circle>
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="block size-2 rounded-full bg-primary" aria-hidden="true" />
                Sample record
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="block size-2 rounded-full bg-amber-600" aria-hidden="true" />
                High uncertainty (&gt;10 km)
              </span>
            </div>
            <span>{formatCoordinate(summary.extent.minLon, 'lon')} to {formatCoordinate(summary.extent.maxLon, 'lon')}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{formatCoordinate(summary.extent.minLat, 'lat')}</div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/35 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Global locator</div>
            <svg className="block aspect-[100/52] w-full rounded-md bg-background" viewBox={`0 0 ${GLOBAL_MAP_WIDTH} ${GLOBAL_MAP_HEIGHT}`} role="img" aria-label="Sample extent shown on a global map">
              <rect x="0" y="0" width={GLOBAL_MAP_WIDTH} height={GLOBAL_MAP_HEIGHT} rx="8" className="fill-background" />
              {globalMap.graticulePath && <path d={globalMap.graticulePath} fill="none" className="stroke-border opacity-60" strokeWidth="0.45" />}
              {globalMap.countryPaths.map((path) => (
                <path key={path.key} d={path.d} className="fill-muted stroke-border" strokeWidth="0.45" />
              ))}
              {globalMap.extentPath && <path d={globalMap.extentPath} className="fill-primary/20 stroke-primary" strokeWidth="1.2" />}
            </svg>
          </div>
          <div className="grid gap-2 text-sm">
            <SpatialStat label="Sampled points" value={formatNumber(summary.points.length)} />
            <SpatialStat label="Latitude range" value={`${formatCoordinate(summary.extent.minLat, 'lat')} – ${formatCoordinate(summary.extent.maxLat, 'lat')}`} />
            <SpatialStat label="Longitude range" value={`${formatCoordinate(summary.extent.minLon, 'lon')} – ${formatCoordinate(summary.extent.maxLon, 'lon')}`} />
          </div>
        </div>
      </div>

      {summary.countryLabels.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Countries with sampled points</p>
          <div className="flex flex-wrap gap-2">
            {summary.countryLabels.slice(0, 8).map((country) => (
              <Badge key={country} variant="secondary">
                {country}
              </Badge>
            ))}
            {summary.countryLabels.length > 8 && (
              <Badge variant="outline">+{summary.countryLabels.length - 8} more</Badge>
            )}
          </div>
        </div>
      )}

      {summary.isConcentrated && (
        <Alert variant="warning" className="mt-4">
          <Info className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertTitle>Concentrated sample detected</AlertTitle>
          <AlertDescription>
            Most sampled points fall in a small region. Range-shift and distribution-mapping questions may need a broader scope to be reliable.
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}

function SpatialStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-mono text-xs leading-5">{value}</strong>
    </div>
  )
}