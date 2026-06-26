import { describe, expect, it } from 'vitest'
import { shouldUseDeterministicFallback } from '../fallbackPolicy.js'
import { createFallbackTriage } from '../fallbackTriage.js'

function makePayload(overrides = {}) {
  const base = {
    intent: {
      analysisType: 'distribution_mapping',
      claimType: 'range',
      countries: ['BR', 'AR'],
      requiredData: ['occurrences', 'coordinates'],
      possibleRequiredExtraData: [],
      confidence: 0.9,
      ambiguities: [],
    },
    taxon: {
      taxonKey: 5219404,
      confidence: 99,
    },
    preview: {
      counts: {
        total: 1000,
        withCoordinates: 800,
        withUsableCoordinates: 750,
        withDate: 700,
        withCoordinatesAndDate: 600,
      },
      facets: {
        years: [],
        countries: [{ name: 'BR', count: 700 }, { name: 'AR', count: 300 }],
        basisOfRecord: [],
        datasets: [],
        issues: [],
        taxa: [{ name: 'Panthera onca', count: 1000 }],
      },
      coordinateUncertainty: { over10kmShare: 0.1 },
      samplingEvents: { datasetHits: 0 },
    },
  }
  return { ...base, ...overrides }
}

describe('shouldUseDeterministicFallback', () => {
  it('allows fallback for transient OpenAI triage failures', () => {
    expect(shouldUseDeterministicFallback(new Error('OpenAI request timed out before it could complete.'))).toBe(true)
    expect(shouldUseDeterministicFallback(new Error('OpenAI network request failed: ECONNRESET'))).toBe(true)
    expect(shouldUseDeterministicFallback(new Error('OpenAI returned no structured output.'))).toBe(true)
    expect(shouldUseDeterministicFallback(new Error('OpenAI request failed with status 503'))).toBe(true)
    expect(shouldUseDeterministicFallback(new Error('OpenAI request failed with status 429'))).toBe(true)
  })

  it('does not hide non-transient OpenAI or validation errors behind fallback', () => {
    expect(shouldUseDeterministicFallback(new Error('OpenAI request failed with status 400'))).toBe(false)
    expect(shouldUseDeterministicFallback(new Error('OPENAI_API_KEY is missing.'))).toBe(false)
    expect(shouldUseDeterministicFallback(new Error('Request body must be a JSON object.'))).toBe(false)
  })
})

describe('createFallbackTriage', () => {
  it('creates a UI-ready deterministic triage from live preview inputs', () => {
    const payload = makePayload()
    const triage = createFallbackTriage({
      intent: payload.intent,
      taxon: payload.taxon,
      preview: payload.preview,
      reason: 'OpenAI request timed out before it could complete.',
    })

    expect(triage.support.headline).toMatch(/GBIF/)
    expect(triage.risks.length).toBeGreaterThanOrEqual(4)
    expect(triage.risks[0].title).toMatch(/AI triage unavailable/)
    expect(triage.readiness.spatial).toBeGreaterThan(0)
    expect(triage.recommendedFilters.length).toBeGreaterThan(0)
    expect(triage.nextSteps.length).toBeGreaterThan(0)
  })

  it('marks zero-record previews as insufficient data', () => {
    const payload = makePayload({
      preview: {
        ...makePayload().preview,
        counts: {
          total: 0,
          withCoordinates: 0,
          withUsableCoordinates: 0,
          withDate: 0,
          withCoordinatesAndDate: 0,
        },
      },
    })
    const triage = createFallbackTriage({
      intent: payload.intent,
      taxon: payload.taxon,
      preview: payload.preview,
      reason: 'OpenAI request timed out before it could complete.',
    })

    expect(triage.support.insufficientData.length).toBeGreaterThan(0)
    expect(triage.risks.some((risk) => risk.level === 'BLOCKING')).toBe(true)
  })
})
