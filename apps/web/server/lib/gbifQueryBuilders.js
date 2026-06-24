// URL, predicate, and SQL builders for the GBIF occurrence API. These are
// pure helpers shared by both the Express handlers and any future preview
// tooling, so they live outside `gbif.js` to keep that file focused on the
// request/response flow.

const OCCURRENCE_API = 'https://api.gbif.org/v1/occurrence/search'
const OCCURRENCE_WEB = 'https://www.gbif.org/occurrence/search'

export function createOccurrenceApiUrl(params, extra = {}) {
  const url = new URL(OCCURRENCE_API)
  appendParams(url, params)
  appendParams(url, extra)
  return url
}

export function createGbifSearchUrl(params) {
  const url = new URL(OCCURRENCE_WEB)
  if (params.taxonKey) url.searchParams.set('taxon_key', String(params.taxonKey))
  if (params.hasCoordinate) url.searchParams.set('occurrence_status', 'present')
  if (params.hasCoordinate) url.searchParams.set('has_coordinate', 'true')
  if (params.hasGeospatialIssue === false) url.searchParams.set('has_geospatial_issue', 'false')
  if (params.year) url.searchParams.set('year', String(params.year))
  const countries = Array.isArray(params.country) ? params.country : params.country ? [String(params.country)] : []
  countries.forEach((country) => url.searchParams.append('country', country))
  return url
}

export function createDownloadPredicate(params) {
  const predicates = [
    { type: 'equals', key: 'HAS_COORDINATE', value: 'true' },
    { type: 'equals', key: 'HAS_GEOSPATIAL_ISSUE', value: 'false' },
  ]

  if (params.taxonKey) {
    predicates.push({ type: 'equals', key: 'TAXON_KEY', value: String(params.taxonKey) })
  }
  if (params.year) {
    const [start, end] = String(params.year).split(',')
    if (start) predicates.push({ type: 'greaterThanOrEquals', key: 'YEAR', value: start })
    if (end) predicates.push({ type: 'lessThanOrEquals', key: 'YEAR', value: end })
  }
  if (params.country) {
    predicates.push({
      type: 'in',
      key: 'COUNTRY',
      values: Array.isArray(params.country) ? params.country : [String(params.country)],
    })
  }

  return { type: 'and', predicates }
}

export function createSqlCubeQuery(params) {
  const where = ['hasCoordinate = TRUE', 'hasGeospatialIssue = FALSE']
  if (params.taxonKey) where.push(`taxonKey = ${Number(params.taxonKey)}`)
  if (params.year) {
    const [start, end] = String(params.year).split(',')
    if (start) where.push(`year >= ${Number(start)}`)
    if (end) where.push(`year <= ${Number(end)}`)
  }
  const countries = Array.isArray(params.country) ? params.country : params.country ? [String(params.country)] : []
  if (countries.length) where.push(`countryCode IN (${countries.map((country) => `'${country.replace(/'/g, "''")}'`).join(', ')})`)

  return `-- GBIF Workbench occurrence-cube starter query
-- Submit through the GBIF SQL download API or adapt in the GBIF.org SQL download UI.
-- This summarizes occurrence counts by species, year, and country.
-- Add grid-cell functions or environmental joins when your analysis requires spatial cubes.

SELECT
  speciesKey,
  species,
  year,
  countryCode,
  basisOfRecord,
  COUNT(*) AS occurrenceCount,
  MIN(coordinateUncertaintyInMeters) AS minCoordinateUncertaintyMeters
FROM occurrence
WHERE ${where.join('\n  AND ')}
GROUP BY speciesKey, species, year, countryCode, basisOfRecord
ORDER BY year, countryCode, species
`
}

function appendParams(url, params) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)))
      return
    }
    url.searchParams.set(key, String(value))
  })
}