import { AlertTriangle, Database } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Metric } from '@/components/form/Metric'
import { PreviewMap } from './PreviewMap'
import { BarList, Histogram, InfoBox } from './PreviewFacets'
import { countryLabel } from '@/lib/regions'
import { formatIssueName, formatNumber, formatShare } from '@/lib/format'
import type { DataPreview } from '@/lib/types'

// Hoisted: the >10km share percentage is formatted once per render of the
// coordinate-uncertainty InfoBox. Building the Intl.NumberFormat at module
// load is cheaper than allocating it on every render.
// See: js-cache-function-results in the Vercel React Best Practices.
const PERCENT_FORMAT = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

export function PreviewPanel({ preview }: { preview: DataPreview }) {
  const total = preview.counts.total

  if (total === 0) {
    return (
      <div className="space-y-3">
        <Alert variant="warning">
          <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertTitle>No matching records</AlertTitle>
          <AlertDescription>
            GBIF returned 0 records for this scope. Try broadening the time window, removing country filters, or picking a higher taxonomic rank.
          </AlertDescription>
        </Alert>
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
          <Database className="mb-2 size-5 text-muted-foreground/70" aria-hidden="true" />
          <p className="font-medium text-foreground">Nothing to preview</p>
          <p className="mt-1 leading-6">Edit the scope above or rerun the analysis to try different filters.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {preview.warnings.map((warning) => (
        <Alert key={warning} variant="warning">
          <AlertTriangle className="col-start-1 row-span-2 mt-0.5 size-4" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
        <Metric label="Matching records" value={formatNumber(total)} detail="Current scope" />
        <Metric label="With coordinates" value={formatNumber(preview.counts.withCoordinates)} detail={formatShare(preview.counts.withCoordinates, total)} />
        <Metric label="Usable coordinates" value={formatNumber(preview.counts.withUsableCoordinates)} detail={formatShare(preview.counts.withUsableCoordinates, total)} />
        <Metric label="Coordinates + date" value={formatNumber(preview.counts.withCoordinatesAndDate)} detail={formatShare(preview.counts.withCoordinatesAndDate, total)} />
      </div>

      <PreviewMap preview={preview} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Histogram title="Records by year" buckets={preview.facets.years} axisLabel="year" />
        <BarList title="Country distribution" buckets={preview.facets.countries.slice(0, 8)} formatter={countryLabel} />
        <BarList title="Basis of record" buckets={preview.facets.basisOfRecord} />
        <BarList title="Top datasets" buckets={preview.facets.datasets.slice(0, 6).map((dataset) => ({ name: dataset.title ?? dataset.name, count: dataset.count }))} />
        <BarList title="Taxonomic breakdown" buckets={preview.facets.taxa.slice(0, 8)} />
        <BarList title="GBIF issues and flags" buckets={preview.facets.issues.slice(0, 8)} formatter={formatIssueName} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <InfoBox
          title="Coordinate uncertainty"
          body={`${formatNumber(preview.coordinateUncertainty.recordsWithUncertainty)} of ${formatNumber(preview.coordinateUncertainty.sampledRecords)} sampled records report uncertainty.`}
          detail={`Median: ${preview.coordinateUncertainty.medianMeters === null ? 'not reported' : `${formatNumber(preview.coordinateUncertainty.medianMeters)} m`}; over 10 km: ${PERCENT_FORMAT.format(preview.coordinateUncertainty.over10kmShare)}.`}
        />
        <InfoBox
          title="Sampling-event discovery"
          body={`${formatNumber(preview.samplingEvents.datasetHits)} dataset hits checked across ${preview.samplingEvents.countriesChecked.length ? preview.samplingEvents.countriesChecked.join(', ') : 'global GBIF'}.`}
          detail={preview.samplingEvents.note}
        />
      </div>
    </div>
  )
}