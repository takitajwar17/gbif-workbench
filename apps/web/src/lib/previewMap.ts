// All d3 / world-atlas / topojson logic for the spatial preview map. Lives in
// `lib/` (not `components/`) because none of these symbols touch React — they
// are pure functions over `DataPreview` + GeoJSON. The React component that
// consumes them lives at `components/preview/PreviewMap.tsx`.

import { geoEqualEarth, geoGraticule, geoMercator, geoPath } from 'd3-geo'
import type { GeoPermissibleObjects, GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiPoint, Polygon } from 'geojson'
import type { GeometryCollection as TopoGeometryCollection, Topology } from 'topojson-specification'
import countries110m from 'world-atlas/countries-110m.json'
import type { DataPreview, OccurrencePoint } from './types'
import { countryLabel } from './regions'

export const ZOOM_MAP_WIDTH = 960
export const ZOOM_MAP_HEIGHT = 520
export const GLOBAL_MAP_WIDTH = 260
export const GLOBAL_MAP_HEIGHT = 136

const WORLD_TOPOLOGY = countries110m as unknown as Topology
const WORLD_OBJECTS = countries110m.objects as { countries: TopoGeometryCollection }
const WORLD_COUNTRIES = (feature(WORLD_TOPOLOGY, WORLD_OBJECTS.countries) as FeatureCollection<Geometry>).features
const WORLD_SPHERE = { type: 'Sphere' } as GeoPermissibleObjects

function hasValidPoint(point: OccurrencePoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180
}

type SpatialSummary = Exclude<ReturnType<typeof summarizeSpatialPreview>, null>

function formatDegrees(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}°`
}

function createCountryPaths(path: ReturnType<typeof geoPath>) {
  return WORLD_COUNTRIES.map((country, index) => {
    const d = path(country)
    return d ? { key: `${country.id ?? index}`, d } : null
  }).filter((item): item is { key: string; d: string } => Boolean(item))
}

function projectOccurrencePoints(points: OccurrencePoint[], projection: GeoProjection) {
  return points
    .map((point) => {
      const projected = projection([point.lon, point.lat])
      if (!projected) return null
      return {
        x: projected[0],
        y: projected[1],
        hasHighUncertainty: (point.coordinateUncertaintyInMeters ?? 0) > 10000,
      }
    })
    .filter((point): point is { x: number; y: number; hasHighUncertainty: boolean } => Boolean(point))
}

function createExtentFeature(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [extent.minLon, extent.minLat],
          [extent.maxLon, extent.minLat],
          [extent.maxLon, extent.maxLat],
          [extent.minLon, extent.maxLat],
          [extent.minLon, extent.minLat],
        ],
      ],
    },
  }
}

function createExtentPointFeature(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Feature<MultiPoint> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPoint',
      coordinates: [
        [extent.minLon, extent.minLat],
        [extent.maxLon, extent.maxLat],
      ],
    },
  }
}

function padExtent(extent: { minLat: number; maxLat: number; minLon: number; maxLon: number }, multiplier: number) {
  const latSpan = Math.max(0.05, extent.maxLat - extent.minLat)
  const lonSpan = Math.max(0.05, extent.maxLon - extent.minLon)
  const latPadding = Math.max(0.35, latSpan * multiplier)
  const lonPadding = Math.max(0.35, lonSpan * multiplier)
  return {
    minLat: clamp(extent.minLat - latPadding, -85, 85),
    maxLat: clamp(extent.maxLat + latPadding, -85, 85),
    minLon: clamp(extent.minLon - lonPadding, -180, 180),
    maxLon: clamp(extent.maxLon + lonPadding, -180, 180),
  }
}

function chooseGraticuleStep(span: number) {
  if (span <= 3) return 0.5
  if (span <= 8) return 1
  if (span <= 20) return 5
  if (span <= 60) return 10
  return 30
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function summarizeSpatialPreview(preview: DataPreview) {
  const points = preview.samplePoints.filter(hasValidPoint).slice(0, 220)
  if (!points.length) return null

  // Single pass to compute lat/lon extent and collect distinct country codes.
  // The Math.min/max spread form would allocate two extra arrays of length N
  // and could blow the argument limit for very large samples; a single loop
  // is both faster and safer.
  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLon = points[0].lon
  let maxLon = points[0].lon
  const countrySet = new Set<string>()
  for (const point of points) {
    if (point.lat < minLat) minLat = point.lat
    else if (point.lat > maxLat) maxLat = point.lat
    if (point.lon < minLon) minLon = point.lon
    else if (point.lon > maxLon) maxLon = point.lon
    if (point.country) countrySet.add(point.country)
  }
  const extent = { minLat, maxLat, minLon, maxLon }
  const latSpan = Math.max(0.01, extent.maxLat - extent.minLat)
  const lonSpan = Math.max(0.01, extent.maxLon - extent.minLon)
  const countryLabels = Array.from(countrySet).sort().map((country) => countryLabel(country))
  const topCountry = preview.facets.countries[0]
  const topCountryText =
    topCountry && preview.counts.total
      ? `${countryLabel(topCountry.name)} accounts for ${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(topCountry.count / preview.counts.total)} of matching records`
      : 'No country facet dominated the preview response'
  const isConcentrated = (latSpan < 5 && lonSpan < 5) || (countryLabels.length <= 1 && points.length >= 10)

  return {
    points,
    extent,
    countryLabels,
    isConcentrated,
    interpretation: isConcentrated
      ? `Preview points are clustered across about ${formatDegrees(latSpan)} latitude by ${formatDegrees(lonSpan)} longitude. ${topCountryText}.`
      : `Preview points cover about ${formatDegrees(latSpan)} latitude by ${formatDegrees(lonSpan)} longitude. ${topCountryText}.`,
  }
}

export function createZoomMapData(summary: SpatialSummary) {
  const paddedExtent = padExtent(summary.extent, 0.5)
  const projection = geoMercator().fitExtent(
    [
      [24, 24],
      [ZOOM_MAP_WIDTH - 24, ZOOM_MAP_HEIGHT - 24],
    ],
    createExtentPointFeature(paddedExtent),
  )
  const path = geoPath(projection)
  const graticule = geoGraticule().step([chooseGraticuleStep(paddedExtent.maxLon - paddedExtent.minLon), chooseGraticuleStep(paddedExtent.maxLat - paddedExtent.minLat)])()

  return {
    countryPaths: createCountryPaths(path),
    graticulePath: path(graticule),
    points: projectOccurrencePoints(summary.points, projection),
  }
}

export function createGlobalMapData(summary: SpatialSummary) {
  const projection = geoEqualEarth().fitExtent(
    [
      [6, 6],
      [GLOBAL_MAP_WIDTH - 6, GLOBAL_MAP_HEIGHT - 6],
    ],
    WORLD_SPHERE,
  )
  const path = geoPath(projection)
  const graticule = geoGraticule().step([60, 30])()
  return {
    countryPaths: createCountryPaths(path),
    graticulePath: path(graticule),
    extentPath: path(createExtentFeature(padExtent(summary.extent, 0.25))),
  }
}

export function formatCoordinate(value: number, axis: 'lat' | 'lon') {
  const direction = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  return `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 1 : 2)}° ${direction}`
}
