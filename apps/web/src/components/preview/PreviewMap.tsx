import { useMemo } from 'react'
import { Map } from 'lucide-react'
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
    return <EmptyState title="No sample points returned" body="GBIF counts completed, but the sample-record request did not return plottable coordinates." />
  }

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Spatial coverage preview">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Map className="size-4 text-primary" />
            Spatial coverage check
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {summary.interpretation} The map uses country outlines and the live preview sample, not the full download.
          </p>
        </div>
        <Badge variant={summary.isConcentrated ? 'warning' : 'success'}>{summary.isConcentrated ? 'Concentrated sample' : 'Broad sample'}</Badge>
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
              <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={point.hasHighUncertainty ? 8 : 6} className={point.hasHighUncertainty ? 'fill-amber-600 opacity-85' : 'fill-primary opacity-85'} />
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><i className="block size-2 rounded-full bg-primary" />Preview record</span>
              <span className="inline-flex items-center gap-1"><i className="block size-2 rounded-full bg-amber-600" />High uncertainty</span>
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
            <SpatialStat label="Countries in sample" value={summary.countryLabels.length ? String(summary.countryLabels.length) : 'Not reported'} />
            <SpatialStat label="Latitude range" value={`${formatCoordinate(summary.extent.minLat, 'lat')} to ${formatCoordinate(summary.extent.maxLat, 'lat')}`} />
            <SpatialStat label="Longitude range" value={`${formatCoordinate(summary.extent.minLon, 'lon')} to ${formatCoordinate(summary.extent.maxLon, 'lon')}`} />
          </div>
        </div>
      </div>

      {summary.countryLabels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.countryLabels.slice(0, 8).map((country) => (
            <Badge key={country} variant="secondary">
              {country}
            </Badge>
          ))}
        </div>
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