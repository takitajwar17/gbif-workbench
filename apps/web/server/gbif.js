const GBIF_API = 'https://api.gbif.org/v1'
const OCCURRENCE_API = `${GBIF_API}/occurrence/search`
const OCCURRENCE_WEB = 'https://www.gbif.org/occurrence/search'
const CACHE_TTL_MS = 1000 * 60 * 30
const CACHE_MAX_ENTRIES = Number(process.env.GBIF_CACHE_MAX_ENTRIES || 500)
const GBIF_TIMEOUT_MS = Number(process.env.GBIF_TIMEOUT_MS || 90000)

// Tiny LRU+TTL cache. Map preserves insertion order, so the first key is the
// least-recently-used entry. We re-insert on every hit to mark it as fresh.
const cache = new Map()

export async function resolveTaxon(intent) {
  const sourceName = String(intent.taxonQuery || intent.taxonText || '').trim()
  if (!sourceName) {
    return {
      scientificName: 'Unspecified taxon',
      canonicalName: 'Unspecified taxon',
      rank: 'UNKNOWN',
      status: 'UNKNOWN',
      taxonKey: null,
      confidence: 0,
      matchType: 'NO_TAXON_QUERY',
      sourceName,
      alternatives: [],
    }
  }

  const rank = normalizeRank(intent.taxonomicRank)
  const matchUrl = new URL(`${GBIF_API}/species/match`)
  matchUrl.searchParams.set('name', sourceName)
  if (rank) matchUrl.searchParams.set('rank', rank)

  const [match, alternatives] = await Promise.all([
    fetchJson(matchUrl),
    fetchTaxonAlternatives(sourceName, rank),
  ])

  const usageKey = numeric(match.usageKey) ?? numeric(match.acceptedUsageKey)
  const bestAlternative = alternatives.find((alternative) => alternative.taxonKey)
  const hasBackboneKey = usageKey !== null

  return {
    scientificName: hasBackboneKey
      ? stringValue(match.scientificName) || stringValue(match.canonicalName) || sourceName
      : bestAlternative?.scientificName ?? sourceName,
    canonicalName: hasBackboneKey
      ? stringValue(match.canonicalName) || stringValue(match.scientificName) || sourceName
      : bestAlternative?.scientificName ?? sourceName,
    rank: hasBackboneKey ? stringValue(match.rank) || bestAlternative?.rank || 'UNKNOWN' : bestAlternative?.rank ?? 'UNKNOWN',
    status: hasBackboneKey
      ? stringValue(match.status) || bestAlternative?.status || 'UNKNOWN'
      : bestAlternative?.status ?? 'SEARCH_MATCH',
    taxonKey: usageKey ?? bestAlternative?.taxonKey ?? null,
    confidence: hasBackboneKey ? numeric(match.confidence) ?? 0 : bestAlternative ? 65 : 0,
    matchType: hasBackboneKey ? stringValue(match.matchType) || 'UNKNOWN' : bestAlternative ? 'SEARCH_FALLBACK' : 'NO_MATCH',
    sourceName,
    alternatives,
  }
}

export function buildGbifQuery(intent, taxon) {
  const apiParams = {
    hasCoordinate: true,
    hasGeospatialIssue: false,
  }

  if (taxon?.taxonKey) apiParams.taxonKey = taxon.taxonKey

  const yearRange = normalizeYearRange(intent.startYear, intent.endYear)
  if (yearRange) apiParams.year = yearRange

  const countries = normalizeCountries(intent.countries)
  if (countries.length) apiParams.country = countries

  return {
    apiParams,
    apiSearchUrl: createOccurrenceApiUrl(apiParams).toString(),
    gbifSearchUrl: createGbifSearchUrl(apiParams).toString(),
    sqlCubeQuery: createSqlCubeQuery(apiParams),
    downloadPredicate: createDownloadPredicate(apiParams),
  }
}

export async function previewGbifData(intent, query) {
  const params = query.apiParams
  const facetResponse = await occurrenceSearch(params, {
    limit: 0,
    facet: ['year', 'country', 'basisOfRecord', 'datasetKey', 'issue', 'speciesKey'],
    facetLimit: 80,
  })

  const [withCoordinates, withUsableCoordinates, sampleResponse, samplingEvents] = await Promise.all([
    occurrenceSearch({ ...params, hasCoordinate: true }, { limit: 0 }),
    occurrenceSearch({ ...params, hasCoordinate: true, hasGeospatialIssue: false }, { limit: 0 }),
    safeSampleSearch({ ...params, hasCoordinate: true, hasGeospatialIssue: false }, { limit: 50 }),
    fetchSamplingEventSummary(intent.countries || []),
  ])

  const facets = normalizeFacets(facetResponse.facets || [])
  const [datasets, taxa] = await Promise.all([
    hydrateDatasets(facets.datasets.slice(0, 10)),
    hydrateTaxa(facets.taxa.slice(0, 10)),
  ])
  const samplePoints = toOccurrencePoints(sampleResponse.results || [])
  const uncertainty = summarizeCoordinateUncertainty(samplePoints)
  const hasYearFilter = Boolean(params.year)
  const withDate = hasYearFilter ? facetResponse.count : sumCounts(facets.years)
  const withCoordinatesAndDate = hasYearFilter ? withUsableCoordinates.count : Math.min(withUsableCoordinates.count, withDate)
  const warnings = []

  if (!taxonFilterApplied(params)) {
    warnings.push('No GBIF taxonKey was applied because the taxon could not be confidently resolved.')
  }
  if (!normalizeCountries(intent.countries).length) {
    warnings.push('No country filters were applied. Review the interpreted region before using the workflow.')
  }
  if (!withUsableCoordinates.count) {
    warnings.push('No georeferenced records without GBIF geospatial issues were found for this preview.')
  }
  if (facetResponse.count > 500000) {
    warnings.push('This query is large; GBIF Workbench used aggregated previews and sample points only.')
  }
  if (sampleResponse.warning) warnings.push(sampleResponse.warning)

  return {
    counts: {
      total: facetResponse.count,
      withCoordinates: withCoordinates.count,
      withUsableCoordinates: withUsableCoordinates.count,
      withDate,
      withCoordinatesAndDate,
    },
    facets: {
      ...facets,
      datasets,
      taxa,
    },
    samplePoints,
    coordinateUncertainty: uncertainty,
    samplingEvents,
    queryUrl: query.apiSearchUrl,
    fetchedAt: new Date().toISOString(),
    warnings,
  }
}

export function normalizeIntent(intent) {
  const countries = normalizeCountries(intent.countries)
  return {
    ...intent,
    taxonText: String(intent.taxonText || intent.taxonQuery || '').trim(),
    taxonQuery: String(intent.taxonQuery || intent.taxonText || '').trim(),
    taxonomicRank: String(intent.taxonomicRank || 'UNKNOWN').toUpperCase(),
    regionText: String(intent.regionText || 'Unspecified region').trim(),
    countries,
    startYear: normalizeYear(intent.startYear),
    endYear: normalizeYear(intent.endYear),
    confidence: clampNumber(intent.confidence, 0, 1, 0),
    requiredData: arrayOfStrings(intent.requiredData),
    possibleRequiredExtraData: arrayOfStrings(intent.possibleRequiredExtraData),
    ambiguities: arrayOfStrings(intent.ambiguities),
  }
}

async function occurrenceSearch(params, extra) {
  return fetchJson(createOccurrenceApiUrl(params, extra))
}

async function safeSampleSearch(params, extra) {
  try {
    return await occurrenceSearch(params, extra)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GBIF sample-record request failed.'
    return {
      count: 0,
      results: [],
      warning: `GBIF sample records could not be fetched for the map preview. Counts and facets still completed. ${message}`,
    }
  }
}

async function fetchTaxonAlternatives(name, rank) {
  try {
    const url = new URL(`${GBIF_API}/species/search`)
    url.searchParams.set('q', name)
    url.searchParams.set('limit', '5')
    url.searchParams.set('status', 'ACCEPTED')
    if (rank) url.searchParams.set('rank', rank)
    const response = await fetchJson(url)
    return (response.results || []).map((item) => ({
      scientificName: stringValue(item.scientificName) || stringValue(item.canonicalName) || 'Unknown taxon',
      rank: stringValue(item.rank) || 'UNKNOWN',
      taxonKey: numeric(item.nubKey) ?? numeric(item.key),
      status: stringValue(item.taxonomicStatus) || stringValue(item.status),
    }))
  } catch {
    return []
  }
}

async function hydrateDatasets(buckets) {
  return Promise.all(
    buckets.map(async (bucket) => {
      try {
        const dataset = await fetchJson(`${GBIF_API}/dataset/${bucket.name}`)
        return {
          ...bucket,
          title: stringValue(dataset.title),
          type: stringValue(dataset.type),
          doi: stringValue(dataset.doi),
        }
      } catch {
        return bucket
      }
    }),
  )
}

async function hydrateTaxa(buckets) {
  return Promise.all(
    buckets.map(async (bucket) => {
      try {
        const taxon = await fetchJson(`${GBIF_API}/species/${bucket.name}`)
        return {
          ...bucket,
          name: stringValue(taxon.scientificName) || stringValue(taxon.canonicalName) || bucket.name,
        }
      } catch {
        return bucket
      }
    }),
  )
}

async function fetchSamplingEventSummary(countries) {
  const checked = normalizeCountries(countries).slice(0, 12)
  if (!checked.length) {
    const global = await fetchJson(`${GBIF_API}/dataset/search?type=SAMPLING_EVENT&limit=0`)
    return {
      countriesChecked: [],
      datasetHits: numeric(global.count) ?? 0,
      note: 'Global sampling-event dataset registrations are a discovery signal, not proof that effort or abundance data exist for the requested taxon.',
    }
  }

  const counts = await Promise.all(
    checked.map(async (country) => {
      try {
        const result = await fetchJson(`${GBIF_API}/dataset/search?type=SAMPLING_EVENT&country=${country}&limit=0`)
        return numeric(result.count) ?? 0
      } catch {
        return 0
      }
    }),
  )

  return {
    countriesChecked: checked,
    datasetHits: counts.reduce((sum, count) => sum + count, 0),
    note: 'Country-filtered sampling-event dataset hits are a discovery signal, not proof that standardized effort, absence, or abundance data exist for the requested taxon.',
  }
}

function createOccurrenceApiUrl(params, extra = {}) {
  const url = new URL(OCCURRENCE_API)
  appendParams(url, params)
  appendParams(url, extra)
  return url
}

function createGbifSearchUrl(params) {
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

function createDownloadPredicate(params) {
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

function createSqlCubeQuery(params) {
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

function normalizeFacets(facets) {
  const byField = new Map(facets.map((facet) => [String(facet.field || '').toUpperCase(), facet.counts || []]))
  return {
    years: sortYearBuckets(byField.get('YEAR') || []),
    countries: byField.get('COUNTRY') || [],
    basisOfRecord: byField.get('BASIS_OF_RECORD') || [],
    datasets: byField.get('DATASET_KEY') || [],
    issues: byField.get('ISSUE') || [],
    taxa: byField.get('SPECIES_KEY') || [],
  }
}

function sortYearBuckets(buckets) {
  return [...buckets].sort((a, b) => Number(a.name) - Number(b.name))
}

function toOccurrencePoints(results) {
  return results
    .map((item) => {
      const lat = numeric(item.decimalLatitude)
      const lon = numeric(item.decimalLongitude)
      const key = numeric(item.key)
      if (lat === null || lon === null || key === null) return null
      return {
        key,
        lat,
        lon,
        year: numeric(item.year) ?? undefined,
        country: stringValue(item.countryCode) || stringValue(item.country),
        basisOfRecord: stringValue(item.basisOfRecord),
        scientificName: stringValue(item.scientificName),
        coordinateUncertaintyInMeters: numeric(item.coordinateUncertaintyInMeters) ?? undefined,
      }
    })
    .filter(Boolean)
}

function summarizeCoordinateUncertainty(points) {
  const values = []
  let over10km = 0
  for (const point of points) {
    const value = point.coordinateUncertaintyInMeters
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    values.push(value)
    if (value > 10000) over10km += 1
  }
  values.sort((a, b) => a - b)
  const median = values.length ? values[Math.floor(values.length / 2)] : null
  return {
    sampledRecords: points.length,
    recordsWithUncertainty: values.length,
    medianMeters: median,
    over10kmShare: values.length ? over10km / values.length : 0,
  }
}

async function fetchJson(input) {
  const url = typeof input === 'string' ? input : input.toString()
  const cached = cache.get(url)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    // Re-insert so this entry becomes the most-recently-used.
    cache.delete(url)
    cache.set(url, cached)
    return cached.value
  }
  if (cached) cache.delete(url)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GBIF_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`GBIF request failed: ${response.status} ${response.statusText}`)
    const value = await response.json()
    cache.set(url, { fetchedAt: Date.now(), value })
    evictCacheIfNeeded()
    return value
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`GBIF request timed out after ${GBIF_TIMEOUT_MS / 1000}s: ${url}`)
    }
    const message = error instanceof Error ? error.message : 'unknown fetch error'
    throw new Error(`GBIF request failed before response: ${url}: ${message}`)
  } finally {
    clearTimeout(timer)
  }
}

function evictCacheIfNeeded() {
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

function normalizeRank(value) {
  const rank = String(value || '').trim().toUpperCase()
  return rank && rank !== 'UNKNOWN' ? rank : ''
}

function normalizeCountries(countries) {
  return [...new Set(arrayOfStrings(countries).map((country) => country.toUpperCase()).filter((country) => /^[A-Z]{2}$/.test(country)))]
}

function normalizeYearRange(startYear, endYear) {
  const start = normalizeYear(startYear)
  const end = normalizeYear(endYear)
  const current = new Date().getFullYear()
  if (start && end) return `${Math.min(start, end)},${Math.max(start, end)}`
  if (start) return `${start},${current}`
  if (end) return `1800,${end}`
  return ''
}

function normalizeYear(value) {
  const year = numeric(value)
  return year && year >= 1800 && year <= new Date().getFullYear() + 1 ? year : null
}

function taxonFilterApplied(params) {
  return Boolean(params.taxonKey)
}

function sumCounts(buckets) {
  return buckets.reduce((sum, bucket) => sum + (numeric(bucket.count) ?? 0), 0)
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function numeric(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function stringValue(value) {
  return typeof value === 'string' ? value : ''
}
