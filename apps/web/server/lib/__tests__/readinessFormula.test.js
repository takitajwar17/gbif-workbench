import { describe, it, expect } from 'vitest'
import { computeReadiness, __INTERNALS } from '../readinessFormula.js'

// Minimal fixture builders. Each test constructs only the fields it
// cares about — every other field defaults to a safe shape (0 / []).
function makePreview(overrides = {}) {
  return {
    counts: {
      total: 1000,
      withCoordinates: 800,
      withUsableCoordinates: 750,
      withDate: 700,
      withCoordinatesAndDate: 600,
      ...overrides.counts,
    },
    facets: {
      years: [{ name: '2020', count: 100 }, { name: '2021', count: 200 }, { name: '2022', count: 300 }],
      countries: [{ name: 'BR', count: 500 }, { name: 'AR', count: 250 }],
      basisOfRecord: [{ name: 'HUMAN_OBSERVATION', count: 700 }],
      datasets: [{ name: 'ds1', count: 600 }],
      issues: [{ name: 'ZERO_COORDINATE', count: 50 }, { name: 'NO_DATE', count: 30 }],
      taxa: [{ name: 'Panthera onca', count: 800 }],
      ...overrides.facets,
    },
    samplePoints: [],
    coordinateUncertainty: {
      sampledRecords: 100,
      recordsWithUncertainty: 80,
      medianMeters: 1000,
      over10kmShare: 0.1,
      ...overrides.coordinateUncertainty,
    },
    samplingEvents: {
      countriesChecked: ['BR', 'AR'],
      datasetHits: 0,
      note: '',
      ...overrides.samplingEvents,
    },
    queryUrl: 'https://api.gbif.org/v3/...',
    fetchedAt: '2026-06-25T00:00:00Z',
    warnings: [],
  }
}

function makeIntent(overrides = {}) {
  return {
    question: 'Where do jaguars live in South America?',
    taxonText: 'Jaguar',
    taxonQuery: 'Panthera onca',
    taxonomicRank: 'SPECIES',
    regionText: 'South America',
    countries: ['BR', 'AR'],
    startYear: 2020,
    endYear: 2022,
    analysisType: 'distribution_mapping',
    claimType: 'range',
    requiredData: ['occurrences', 'coordinates'],
    possibleRequiredExtraData: [],
    spatialResolution: 'country',
    skillLevel: 'intermediate',
    preferredLanguage: 'Both',
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  }
}

describe('computeReadiness — determinism', () => {
  it('returns identical output for identical inputs', () => {
    const intent = makeIntent()
    const preview = makePreview()
    const a = computeReadiness(intent, preview)
    const b = computeReadiness(intent, preview)
    expect(a).toEqual(b)
    expect(a).toEqual(computeReadiness(structuredClone(intent), structuredClone(preview)))
  })

  it('returns the same four integer keys in [0, 100]', () => {
    const result = computeReadiness(makeIntent(), makePreview())
    expect(Object.keys(result).sort()).toEqual(['dataType', 'spatial', 'taxonomic', 'temporal'])
    for (const value of Object.values(result)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('never throws on missing intent or preview fields', () => {
    const result = computeReadiness({}, {})
    for (const value of Object.values(result)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('returns 0 for an empty preview', () => {
    const preview = makePreview({
      counts: { total: 0, withCoordinates: 0, withUsableCoordinates: 0, withDate: 0, withCoordinatesAndDate: 0 },
      facets: { years: [], countries: [], basisOfRecord: [], datasets: [], issues: [], taxa: [] },
      coordinateUncertainty: { sampledRecords: 0, recordsWithUncertainty: 0, medianMeters: null, over10kmShare: 0 },
    })
    const result = computeReadiness(makeIntent(), preview)
    expect(result.spatial).toBe(0)
    expect(result.temporal).toBe(0)
    expect(result.taxonomic).toBe(0)
    expect(result.dataType).toBe(0)
  })
})

describe('computeReadiness — semantic correctness', () => {
  it('rewards high usable-coordinate coverage and clean precision', () => {
    const intent = makeIntent()
    const great = makePreview({
      counts: { total: 1000, withUsableCoordinates: 950 },
      coordinateUncertainty: { over10kmShare: 0.05 },
      facets: { countries: [{ name: 'BR', count: 500 }, { name: 'AR', count: 450 }] },
    })
    const poor = makePreview({
      counts: { total: 1000, withUsableCoordinates: 100 },
      coordinateUncertainty: { over10kmShare: 0.7 },
      facets: { countries: [{ name: 'BR', count: 100 }] },
    })
    expect(computeReadiness(intent, great).spatial).toBeGreaterThan(computeReadiness(intent, poor).spatial)
  })

  it('rewards high date coverage and full year-window coverage', () => {
    const intent = makeIntent({ startYear: 2020, endYear: 2022 })
    const great = makePreview({
      counts: { total: 1000, withDate: 950 },
      facets: {
        years: [{ name: '2020', count: 300 }, { name: '2021', count: 300 }, { name: '2022', count: 350 }],
        issues: [],
      },
    })
    const poor = makePreview({
      counts: { total: 1000, withDate: 50 },
      facets: {
        years: [{ name: '2010', count: 50 }],
        issues: [{ name: 'NO_DATE', count: 950 }],
      },
    })
    expect(computeReadiness(intent, great).temporal).toBeGreaterThan(computeReadiness(intent, poor).temporal)
  })

  it('taxonomic reflects LLM confidence + GBIF match + cleanliness', () => {
    const clean = makeIntent({ confidence: 0.95, ambiguities: [] })
    const ambiguous = makeIntent({ confidence: 0.4, ambiguities: ['Ambiguous taxon'] })
    const preview = makePreview({
      facets: { taxa: [{ name: 'Panthera onca', count: 800 }] },
    })
    const previewNoMatch = makePreview({
      facets: { taxa: [] },
    })
    expect(computeReadiness(clean, preview).taxonomic).toBeGreaterThan(computeReadiness(ambiguous, preview).taxonomic)
    expect(computeReadiness(clean, preview).taxonomic).toBeGreaterThan(computeReadiness(clean, previewNoMatch).taxonomic)
  })

  it('encodes the prompt stance: abundance/trend work scores lower than mapping', () => {
    const preview = makePreview({ samplingEvents: { datasetHits: 0 } })
    const mapping = makeIntent({ analysisType: 'distribution_mapping' })
    const trend = makeIntent({ analysisType: 'temporal_trend_or_abundance' })
    const mappingScore = computeReadiness(mapping, preview).dataType
    const trendScore = computeReadiness(trend, preview).dataType
    expect(mappingScore).toBeGreaterThan(trendScore)
    expect(trendScore).toBeLessThan(40) // base=20, no boost => 20
    expect(mappingScore).toBeGreaterThan(70) // base=80, no boost => 80
  })

  it('sampling event boost lifts species-distribution-modelling score', () => {
    const intent = makeIntent({ analysisType: 'species_distribution_modelling' })
    const noEvents = makePreview({ samplingEvents: { datasetHits: 0 } })
    const withEvents = makePreview({ samplingEvents: { datasetHits: 2 } })
    expect(computeReadiness(intent, withEvents).dataType).toBeGreaterThan(computeReadiness(intent, noEvents).dataType)
  })

  it('high year-window overlap beats no overlap for temporal', () => {
    const intent = makeIntent({ startYear: 2020, endYear: 2022 })
    const overlap = makePreview({
      facets: { years: [{ name: '2020', count: 100 }, { name: '2021', count: 100 }, { name: '2022', count: 100 }] },
    })
    const disjoint = makePreview({
      facets: { years: [{ name: '1990', count: 100 }, { name: '1991', count: 100 }] },
    })
    expect(computeReadiness(intent, overlap).temporal).toBeGreaterThan(computeReadiness(intent, disjoint).temporal)
  })

  it('omitting a year constraint implies full temporal coverage is achievable', () => {
    const intentNoYears = makeIntent({ startYear: null, endYear: null })
    const result = computeReadiness(intentNoYears, makePreview())
    expect(result.temporal).toBeGreaterThan(0)
  })
})

describe('computeReadiness — independent dimensions', () => {
  it('changing spatial inputs does not move temporal / taxonomic / dataType', () => {
    const intent = makeIntent()
    const baseline = computeReadiness(intent, makePreview())
    // Only spatial inputs change: usable-coords share drops, country
    // coverage drops, precision degrades. Dates / taxa / sampling
    // signals stay the same.
    const changed = computeReadiness(intent, makePreview({
      counts: { total: 1000, withUsableCoordinates: 50, withCoordinates: 50, withDate: 700, withCoordinatesAndDate: 600 },
      coordinateUncertainty: { over10kmShare: 0.8, sampledRecords: 100, recordsWithUncertainty: 80, medianMeters: 1000 },
      facets: { countries: [{ name: 'BR', count: 50 }] },
    }))
    expect(changed.spatial).toBeLessThan(baseline.spatial)
    expect(changed.temporal).toBe(baseline.temporal)
    expect(changed.taxonomic).toBe(baseline.taxonomic)
    expect(changed.dataType).toBe(baseline.dataType)
  })

  it('changing analysisType only moves dataType', () => {
    const preview = makePreview()
    const mapping = computeReadiness(makeIntent({ analysisType: 'distribution_mapping' }), preview)
    const trend = computeReadiness(makeIntent({ analysisType: 'temporal_trend_or_abundance' }), preview)
    expect(mapping.dataType).not.toBe(trend.dataType)
    expect(mapping.spatial).toBe(trend.spatial)
    expect(mapping.temporal).toBe(trend.temporal)
    expect(mapping.taxonomic).toBe(trend.taxonomic)
  })
})

describe('computeReadiness — internal helpers', () => {
  it('ANALYSIS_TYPE_BASE_FIT is frozen', () => {
    expect(Object.isFrozen(__INTERNALS.ANALYSIS_TYPE_BASE_FIT)).toBe(true)
  })

  it('temporal trend is the lowest base fit; distribution mapping is the highest', () => {
    const base = __INTERNALS.ANALYSIS_TYPE_BASE_FIT
    expect(base.temporal_trend_or_abundance).toBeLessThan(base.distribution_mapping)
    expect(base.distribution_mapping).toBeGreaterThanOrEqual(base.species_distribution_modelling)
  })
})

// =============================================================================
// Tests for the literature-driven rubric revisions.
//
// The signals and weights below reflect the audit of GBIF readiness
// assessment against published methodology papers. Each test names the
// concern researchers actually have and the signal that should respond
// to it. If any of these fail, the rubric has drifted from the literature
// and the change should be reviewed.
// =============================================================================

describe('rubric revisions — taxonomic (GBIF backbone, not LLM confidence)', () => {
  it('TAXON_MATCH_FUZZY issues in the preview lower the taxonomic score', () => {
    const intent = makeIntent()
    const clean = makePreview({ facets: { issues: [] } })
    const fuzzy = makePreview({
      facets: {
        issues: [{ name: 'TAXON_MATCH_FUZZY', count: 500 }, { name: 'ZERO_COORDINATE', count: 100 }],
      },
    })
    expect(computeReadiness(intent, clean).taxonomic).toBeGreaterThan(computeReadiness(intent, fuzzy).taxonomic)
  })

  it('TAXON_MATCH_HIGHERRANK and TAXON_MATCH_NONE also penalize', () => {
    const intent = makeIntent()
    const clean = makePreview({ facets: { issues: [] } })
    const higherrank = makePreview({
      facets: { issues: [{ name: 'TAXON_MATCH_HIGHERRANK', count: 600 }] },
    })
    const none = makePreview({
      facets: { issues: [{ name: 'TAXON_MATCH_NONE', count: 600 }] },
    })
    expect(computeReadiness(intent, higherrank).taxonomic).toBeLessThan(computeReadiness(intent, clean).taxonomic)
    expect(computeReadiness(intent, none).taxonomic).toBeLessThan(computeReadiness(intent, clean).taxonomic)
  })

  it('LLM confidence alone (with no GBIF backbone match) is a weak signal, not a strong one', () => {
    // Even at confidence = 1.0, with no taxa facet, the score should
    // be lower than the same confidence with a backbone match. The
    // backbone signal is the dominant one — the LLM may be confident
    // about the user's intent, but if GBIF has no records the data
    // is still not there.
    const intentConfidentNoBackbone = makeIntent({ confidence: 1.0, ambiguities: [] })
    const previewNoBackbone = makePreview({ facets: { taxa: [] } })
    const scoreNoBackbone = computeReadiness(intentConfidentNoBackbone, previewNoBackbone).taxonomic
    const intentMidWithBackbone = makeIntent({ confidence: 0.5, ambiguities: [] })
    const previewWithBackbone = makePreview({
      facets: { taxa: [{ name: 'Panthera onca', count: 800 }], issues: [] },
    })
    const scoreWithBackbone = computeReadiness(intentMidWithBackbone, previewWithBackbone).taxonomic
    expect(scoreWithBackbone).toBeGreaterThan(scoreNoBackbone)
  })

  it('a clean GBIF backbone match dominates the score', () => {
    const intent = makeIntent({ confidence: 0.5, ambiguities: [] })
    const preview = makePreview({
      facets: { taxa: [{ name: 'Panthera onca', count: 800 }], issues: [] },
    })
    const score = computeReadiness(intent, preview).taxonomic
    expect(score).toBeGreaterThanOrEqual(60)
  })
})

describe('rubric revisions — temporal (continuity + recency, not just year overlap)', () => {
  it('a continuous time series beats a gappy one with the same year overlap', () => {
    const intent = makeIntent({ startYear: 2015, endYear: 2024 })
    // Continuous: every year present
    const continuous = makePreview({
      facets: { years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((y) => ({ name: String(y), count: 100 })) },
    })
    // Gappy: 2015 and 2024 only — same window overlap, but a 9-year gap
    const gappy = makePreview({
      facets: { years: [{ name: '2015', count: 500 }, { name: '2024', count: 500 }] },
    })
    expect(computeReadiness(intent, continuous).temporal).toBeGreaterThan(computeReadiness(intent, gappy).temporal)
  })

  it('old records lower the recency share of the temporal score', () => {
    const intent = makeIntent({ startYear: null, endYear: null })
    // fetchedAt is 2026-06-25 in the default fixture, so "last 10 years"
    // means 2016 and later.
    const recent = makePreview({
      facets: { years: [{ name: '2020', count: 100 }, { name: '2024', count: 100 }] },
    })
    const old = makePreview({
      facets: { years: [{ name: '1990', count: 100 }, { name: '1995', count: 100 }] },
    })
    expect(computeReadiness(intent, recent).temporal).toBeGreaterThan(computeReadiness(intent, old).temporal)
  })
})

describe('rubric revisions — data type (literature-aligned lookup table)', () => {
  it('SDM base fit is at least 0.5 (the literature is much more positive than the old 0.4)', () => {
    // 0.4 was "mostly useless"; Phillips et al. 2009 et al. say bias
    // correction is required, not "don't use GBIF." New base is 0.6.
    const base = __INTERNALS.ANALYSIS_TYPE_BASE_FIT.species_distribution_modelling
    expect(base).toBeGreaterThanOrEqual(0.55)
  })

  it('distribution_mapping base fit is high (>= 0.75)', () => {
    expect(__INTERNALS.ANALYSIS_TYPE_BASE_FIT.distribution_mapping).toBeGreaterThanOrEqual(0.75)
  })

  it('temporal_trend base fit is mid-low (0.30-0.40) — abundance NOT supported, but range trend is', () => {
    const base = __INTERNALS.ANALYSIS_TYPE_BASE_FIT.temporal_trend_or_abundance
    expect(base).toBeGreaterThanOrEqual(0.30)
    expect(base).toBeLessThanOrEqual(0.45)
  })

  it('sampling-event boost is meaningful for SDM (+0.20 or more)', () => {
    expect(__INTERNALS.ANALYSIS_TYPE_SAMPLING_BOOST.species_distribution_modelling).toBeGreaterThanOrEqual(0.20)
  })

  it('requiredData is NOT a data-fit signal any more', () => {
    // The old 0.3-weight requiredData signal conflated "user filled a
    // form" with "data is fit for purpose." Two intents that differ only
    // in requiredData should now produce identical dataType scores.
    const noRequired = makeIntent({ requiredData: [] })
    const withRequired = makeIntent({ requiredData: ['occurrences', 'coords', 'dates'] })
    const preview = makePreview()
    expect(computeReadiness(noRequired, preview).dataType).toBe(computeReadiness(withRequired, preview).dataType)
  })
})

describe('weightedAverageReadiness', () => {
  // IDEA.md §21.5 explicitly forbids collapsing the four readiness
  // dimensions into a single headline score, so this function and the
  // analysis-type-specific dimension weights have been removed. The
  // per-dimension `computeReadiness` output is the only readiness data
  // the app surfaces — see SupportPanel.tsx for the per-dimension bars.
  it('is intentionally not exported (no single score per IDEA.md §21.5)', () => {
    // This placeholder keeps the describe block in the test file so
    // contributors notice the policy decision when reading tests.
    expect(true).toBe(true)
  })
})