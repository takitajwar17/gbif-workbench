// Spatial preview helpers. The synchronous functions compute summary text and
// extents without loading map libraries. Country outlines, projections, and
// topojson conversion are loaded only when `PreviewMap` needs to draw a map.
//
// Bundle split:
//   - Summary helpers stay in the main chunk so the panel can render text and
//     stats immediately.
//   - `loadMapData()` dynamically imports `d3-geo`, `topojson-client`, and the
//     107 KB world atlas JSON after a successful analysis with sample points.
//   - `loadMapData()` caches its result on the module so subsequent renders
//     (e.g. when the user opens the panel twice) skip the network + decode.

import type { GeoPath, GeoPermissibleObjects, GeoProjection } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, MultiPoint, Polygon } from 'geojson'
import type { GeometryCollection as TopoGeometryCollection, Topology } from 'topojson-specification'
import type { DataPreview, OccurrencePoint } from './types'
import { countryLabel } from './regions'

export const ZOOM_MAP_WIDTH = 960
export const ZOOM_MAP_HEIGHT = 520
export const GLOBAL_MAP_WIDTH = 260
export const GLOBAL_MAP_HEIGHT = 136

// Module-scope cache for the lazy-loaded world atlas + the projected country
// features derived from it. The atlas JSON never changes after first load,
// and the projected FeatureCollection is computed once and reused across all
// analyses in the session. `worldAtlasPromise` is typed as the raw `Topology`
// because the dynamic JSON import returns a `Topology` and the cast to the
// `& { objects: { countries: ... } }` shape only happens inside the loader.
let worldAtlasPromise: Promise<Topology> | null = null
let worldCountries: Feature<Geometry>[] | null = null

const WORLD_SPHERE = { type: 'Sphere' } as GeoPermissibleObjects

// Hoisted: `summarizeSpatialPreview` runs the top-country percent formatting
// on every call. Building the formatter at module load is cheaper than
// allocating it on every call.
// See: js-cache-function-results in the Vercel React Best Practices.
const PERCENT_FORMAT = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

function hasValidPoint(point: OccurrencePoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180
}

type SpatialSummary = Exclude<ReturnType<typeof summarizeSpatialPreview>, null>
type D3GeoModule = typeof import('d3-geo')

export type MapData = {
  zoomMap: {
    countryPaths: { key: string; d: string }[]
    graticulePath: string | null
    points: { x: number; y: number; hasHighUncertainty: boolean }[]
  }
  globalMap: {
    countryPaths: { key: string; d: string }[]
    graticulePath: string | null
    extentPath: string | null
  }
}

function formatDegrees(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}°`
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

function createCountryPaths(path: GeoPath, countries: Feature<Geometry>[]) {
  return countries
    .map((country, index) => {
      const d = path(country)
      return d ? { key: `${country.id ?? index}`, d } : null
    })
    .filter((item): item is { key: string; d: string } => Boolean(item))
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
      ? `${countryLabel(topCountry.name)} accounts for ${PERCENT_FORMAT.format(topCountry.count / preview.counts.total)} of matching records`
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

// Lazy-loads the world atlas JSON and decodes the country FeatureCollection.
// Both the network fetch (Vite splits the JSON into its own chunk) and the
// topojson → GeoJSON conversion run once per session and are memoized on the
// module. `loadMapData()` below waits on this promise before projecting paths.
async function loadWorldCountries(): Promise<Feature<Geometry>[]> {
  if (worldCountries) return worldCountries
  if (!worldAtlasPromise) {
    worldAtlasPromise = (async () => {
      const { default: countries110m } = await import('world-atlas/countries-110m.json')
      return countries110m as unknown as Topology
    })()
  }
  const [atlas, topojson] = await Promise.all([worldAtlasPromise, import('topojson-client')])
  const countries = (atlas as unknown as { objects: { countries: TopoGeometryCollection } }).objects.countries
  worldCountries = (topojson.feature(atlas, countries) as FeatureCollection<Geometry>).features
  return worldCountries
}

// Async: dynamically imports the world atlas, then projects the country
// outlines + sample points for both the zoomed sample view and the global
// locator. Callers should treat this as a one-shot resource fetch — the
// resulting `MapData` is small and re-projecting for a new `summary` is
// cheap, so we don't cache the projections themselves.
export async function loadMapData(summary: SpatialSummary): Promise<MapData> {
  const [countries, d3Geo] = await Promise.all([loadWorldCountries(), import('d3-geo')])
  return buildMapData(summary, countries, d3Geo)
}

function buildMapData(summary: SpatialSummary, countries: Feature<Geometry>[], d3Geo: D3GeoModule): MapData {
  const { geoEqualEarth, geoGraticule, geoMercator, geoPath } = d3Geo
  const paddedExtent = padExtent(summary.extent, 0.5)
  const zoomProjection = geoMercator().fitExtent(
    [
      [24, 24],
      [ZOOM_MAP_WIDTH - 24, ZOOM_MAP_HEIGHT - 24],
    ],
    createExtentPointFeature(paddedExtent),
  )
  const zoomPath = geoPath(zoomProjection)
  const zoomGraticule = geoGraticule().step([
    chooseGraticuleStep(paddedExtent.maxLon - paddedExtent.minLon),
    chooseGraticuleStep(paddedExtent.maxLat - paddedExtent.minLat),
  ])()

  const globalProjection = geoEqualEarth().fitExtent(
    [
      [6, 6],
      [GLOBAL_MAP_WIDTH - 6, GLOBAL_MAP_HEIGHT - 6],
    ],
    WORLD_SPHERE,
  )
  const globalPath = geoPath(globalProjection)
  const globalGraticule = geoGraticule().step([60, 30])()

  return {
    zoomMap: {
      countryPaths: createCountryPaths(zoomPath, countries),
      graticulePath: zoomPath(zoomGraticule),
      points: projectOccurrencePoints(summary.points, zoomProjection),
    },
    globalMap: {
      countryPaths: createCountryPaths(globalPath, countries),
      graticulePath: globalPath(globalGraticule),
      extentPath: globalPath(createExtentFeature(padExtent(summary.extent, 0.25))),
    },
  }
}

export function formatCoordinate(value: number, axis: 'lat' | 'lon') {
  const direction = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  return `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 1 : 2)}° ${direction}`
}
