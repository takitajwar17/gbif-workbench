import { describe, expect, it } from 'vitest'
import {
  createHistoryPayload,
  createHistorySummary,
  getHistoryDatabaseUrl,
  isHistoryDatabaseConfigured,
} from '../../historyStore.js'

describe('history database configuration', () => {
  it('accepts Vercel marketplace Neon and legacy Postgres env names', () => {
    expect(getHistoryDatabaseUrl({ DATABASE_URL: 'postgres://database' })).toBe('postgres://database')
    expect(getHistoryDatabaseUrl({ POSTGRES_URL: 'postgres://postgres' })).toBe('postgres://postgres')
    expect(getHistoryDatabaseUrl({ NEON_DATABASE_URL: 'postgres://neon' })).toBe('postgres://neon')
    expect(isHistoryDatabaseConfigured({})).toBe(false)
    expect(isHistoryDatabaseConfigured({ DATABASE_URL: 'postgres://...' })).toBe(false)
  })
})

describe('createHistoryPayload', () => {
  it('stores the full restorable analysis snapshot', () => {
    const payload = createHistoryPayload(createSnapshot())

    expect(payload.version).toBe(1)
    expect(payload.status).toBe('workflow_ready')
    expect(payload.question).toBe('Can GBIF support a tiger distribution map in Bangladesh?')
    expect(payload.intent.taxonText).toBe('Panthera tigris')
    expect(payload.taxon.canonicalName).toBe('Panthera tigris')
    expect(payload.query.gbifSearchUrl).toContain('gbif.org')
    expect(payload.preview.counts.total).toBe(120)
    expect(payload.triage?.support.headline).toBe('Usable with caveats')
    expect(payload.workflow.rCode).toContain('rgbif')
  })

  it('stores preview-ready snapshots before workflow exports exist', () => {
    const payload = createHistoryPayload({ ...createSnapshot(), workflow: null })

    expect(payload.status).toBe('preview_ready')
    expect(payload.workflow).toBeNull()
    expect(payload.triage?.support.headline).toBe('Usable with caveats')
  })

  it('rejects incomplete snapshots', () => {
    expect(() => createHistoryPayload({ question: 'Missing result' })).toThrow(/incomplete/)
  })
})

describe('createHistorySummary', () => {
  it('creates compact list metadata from the full payload', () => {
    const summary = createHistorySummary(createHistoryPayload(createSnapshot()))

    expect(summary).toMatchObject({
      question: 'Can GBIF support a tiger distribution map in Bangladesh?',
      taxonName: 'Panthera tigris',
      regionText: 'Bangladesh',
      countries: ['BD'],
      analysisType: 'distribution_mapping',
      supportHeadline: 'Usable with caveats',
      recordCount: 120,
    })
  })
})

function createSnapshot() {
  return {
    question: 'Can GBIF support a tiger distribution map in Bangladesh?',
    preferredLanguage: 'Both',
    intent: {
      question: 'Can GBIF support a tiger distribution map in Bangladesh?',
      taxonText: 'Panthera tigris',
      taxonQuery: 'Panthera tigris',
      taxonomicRank: 'species',
      regionText: 'Bangladesh',
      countries: ['BD'],
      startYear: 2000,
      endYear: 2025,
      analysisType: 'distribution_mapping',
      claimType: 'distribution',
      requiredData: ['occurrences'],
      possibleRequiredExtraData: [],
      spatialResolution: 'country',
      skillLevel: 'intermediate',
      preferredLanguage: 'Both',
      confidence: 0.9,
      ambiguities: [],
    },
    taxon: {
      scientificName: 'Panthera tigris (Linnaeus, 1758)',
      canonicalName: 'Panthera tigris',
      rank: 'SPECIES',
      status: 'ACCEPTED',
      taxonKey: 5219404,
      confidence: 99,
      matchType: 'EXACT',
      sourceName: 'Panthera tigris',
      alternatives: [],
    },
    query: {
      apiParams: { taxon_key: 5219404, country: ['BD'] },
      apiSearchUrl: 'https://api.gbif.org/v1/occurrence/search',
      gbifSearchUrl: 'https://www.gbif.org/occurrence/search',
      sqlCubeQuery: 'select * from occurrence',
      downloadPredicate: { type: 'and', predicates: [] },
    },
    preview: {
      counts: {
        total: 120,
        withCoordinates: 100,
        withUsableCoordinates: 92,
        withDate: 90,
        withCoordinatesAndDate: 88,
      },
      facets: {
        years: [],
        countries: [],
        basisOfRecord: [],
        datasets: [],
        issues: [],
        taxa: [],
      },
      samplePoints: [],
      coordinateUncertainty: {
        sampledRecords: 0,
        recordsWithUncertainty: 0,
        medianMeters: null,
        over10kmShare: 0,
      },
      samplingEvents: {
        countriesChecked: ['BD'],
        datasetHits: 0,
        note: '',
      },
      queryUrl: 'https://api.gbif.org/v1/occurrence/search',
      fetchedAt: '2026-06-26T00:00:00.000Z',
      warnings: [],
    },
    triage: {
      support: {
        headline: 'Usable with caveats',
        stronglySupported: [],
        conditionallySupported: [],
        exploratoryOnly: [],
        notSupportedWithOccurrenceOnly: [],
        insufficientData: [],
      },
      risks: [],
      readiness: {
        spatial: 80,
        temporal: 70,
        taxonomic: 85,
        dataType: 60,
      },
      recommendedFilters: [],
      unsupportedClaims: [],
      nextSteps: [],
    },
    workflow: {
      rCode: 'library(rgbif)',
      pythonCode: 'import pandas as pd',
      sqlCode: 'select 1',
      downloadRequestJson: '{}',
      cleaningR: 'records',
      methodsText: 'Methods',
      limitationsText: 'Limitations',
      citationInstructions: 'Cite DOI',
      markdownReport: '# Report',
      htmlReport: '<h1>Report</h1>',
      jsonPlan: '{}',
    },
    models: {
      intent: 'gpt',
      triage: 'gpt',
      workflow: 'gpt',
    },
  }
}
