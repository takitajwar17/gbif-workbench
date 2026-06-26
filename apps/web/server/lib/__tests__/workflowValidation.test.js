import { describe, it, expect } from 'vitest'
import { validateWorkflowBody } from '../../workflow.js'

// Fixture: minimal payload that matches the shape /api/study-plan
// returns. Each test that needs a "good" payload uses this and only
// overrides the field it cares about.
function makePayload(overrides = {}) {
  return {
    intent: {
      question: 'Where do jaguars live in South America?',
      taxonText: 'Jaguar',
      taxonQuery: 'Panthera onca',
      taxonomicRank: 'SPECIES',
      regionText: 'South America',
      countries: ['BR', 'AR'],
      startYear: 2020,
      endYear: 2024,
      analysisType: 'distribution_mapping',
      claimType: 'range',
      requiredData: ['occurrences', 'coordinates'],
      possibleRequiredExtraData: [],
      spatialResolution: 'country',
      skillLevel: 'intermediate',
      preferredLanguage: 'Both',
      confidence: 0.9,
      ambiguities: [],
    },
    taxon: {
      scientificName: 'Panthera onca',
      canonicalName: 'Panthera onca (Linnaeus, 1758)',
      rank: 'SPECIES',
      status: 'ACCEPTED',
      taxonKey: 5219404,
      confidence: 99,
      matchType: 'EXACT',
      sourceName: 'Panthera onca',
      alternatives: [],
    },
    query: {
      apiParams: { taxonKey: 5219404, country: ['BR', 'AR'], year: '2020,2024' },
      apiSearchUrl: 'https://api.gbif.org/v3/...',
      gbifSearchUrl: 'https://www.gbif.org/occurrence/search?...',
      sqlCubeQuery: 'SELECT * FROM occurrence WHERE taxonKey = 5219404',
      downloadPredicate: { type: 'and', predicates: [] },
    },
    preview: {
      counts: { total: 1000, withCoordinates: 800, withUsableCoordinates: 750, withDate: 700, withCoordinatesAndDate: 600 },
      facets: { years: [], countries: [], basisOfRecord: [], datasets: [], issues: [], taxa: [] },
      samplePoints: [],
      coordinateUncertainty: { sampledRecords: 100, recordsWithUncertainty: 80, medianMeters: 1000, over10kmShare: 0.1 },
      samplingEvents: { countriesChecked: ['BR', 'AR'], datasetHits: 0, note: '' },
      queryUrl: 'https://api.gbif.org/v3/...',
      fetchedAt: '2026-06-25T00:00:00Z',
      warnings: [],
    },
    triage: null,
    ...overrides,
  }
}

describe('validateWorkflowBody — happy path', () => {
  it('accepts a complete payload', () => {
    const result = validateWorkflowBody(makePayload())
    expect(result.ok).toBe(true)
    expect(result.value.intent.taxonQuery).toBe('Panthera onca')
    expect(result.value.triage).toBeNull()
  })

  it('passes triage through when present', () => {
    const triage = { support: { headline: 'good' }, risks: [], readiness: { spatial: 80, temporal: 80, taxonomic: 80, dataType: 80 } }
    const result = validateWorkflowBody(makePayload({ triage }))
    expect(result.ok).toBe(true)
    expect(result.value.triage).toBe(triage)
  })

  it('normalizes a missing triage to null', () => {
    const payload = makePayload()
    delete payload.triage
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(true)
    expect(result.value.triage).toBeNull()
  })

  it('normalizes a non-object triage (string) to null', () => {
    const result = validateWorkflowBody(makePayload({ triage: 'not-an-object' }))
    expect(result.ok).toBe(true)
    expect(result.value.triage).toBeNull()
  })
})

describe('validateWorkflowBody — rejection cases', () => {
  it('rejects an empty body', () => {
    expect(validateWorkflowBody(null).ok).toBe(false)
    expect(validateWorkflowBody(undefined).ok).toBe(false)
    expect(validateWorkflowBody('').ok).toBe(false)
    expect(validateWorkflowBody(42).ok).toBe(false)
  })

  it('rejects a body missing intent', () => {
    const payload = makePayload()
    delete payload.intent
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/intent/)
  })

  it('rejects a body missing taxon', () => {
    const payload = makePayload()
    delete payload.taxon
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/taxon/)
  })

  it('rejects a body missing query', () => {
    const payload = makePayload()
    delete payload.query
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/query/)
  })

  it('rejects a body missing preview', () => {
    const payload = makePayload()
    delete payload.preview
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/preview/)
  })

  it('rejects a body whose intent is the wrong type', () => {
    const result = validateWorkflowBody(makePayload({ intent: 'not-an-object' }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/intent/)
  })

  it('rejects a body whose taxon is null', () => {
    const result = validateWorkflowBody(makePayload({ taxon: null }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/taxon/)
  })

  it('rejects a body whose preview is undefined', () => {
    const payload = makePayload()
    payload.preview = undefined
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/preview/)
  })
})

describe('validateWorkflowBody — does not deep-validate', () => {
  // We deliberately accept structurally-valid shapes even when the
  // fields inside don't match the canonical TriageResult / DataPreview
  // / etc. The downstream handlers do their own field-level
  // validation; the boundary check just ensures the four required
  // top-level objects are present. This keeps the validator simple
  // and avoids rejecting harmless field reorderings.
  it('accepts a payload with sparse intent fields', () => {
    const result = validateWorkflowBody(makePayload({ intent: { taxonQuery: 'X' } }))
    expect(result.ok).toBe(true)
  })

  it('accepts a payload with sparse preview counts', () => {
    const payload = makePayload()
    payload.preview = { counts: { total: 0 } }
    const result = validateWorkflowBody(payload)
    expect(result.ok).toBe(true)
  })
})