import { describe, expect, it } from 'vitest'
import { createFallbackWorkflow } from '../fallbackWorkflow.js'
import { finalizeWorkflow } from '../../workflow.js'

function makePayload() {
  return {
    intent: {
      question: 'Can GBIF occurrence records support mapping kingfisher records in Bangladesh since 2000?',
      taxonText: 'kingfishers',
      analysisType: 'distribution_mapping',
      regionText: 'Bangladesh',
      countries: ['BD'],
      startYear: 2000,
      endYear: 2026,
      requiredData: ['occurrences', 'coordinates'],
      possibleRequiredExtraData: [],
    },
    taxon: {
      scientificName: 'Alcedinidae',
      taxonKey: 2984,
      confidence: 95,
    },
    query: {
      apiParams: {
        taxonKey: 2984,
        country: ['BD'],
        year: '2000,2026',
        hasCoordinate: true,
        hasGeospatialIssue: false,
      },
      apiSearchUrl: 'https://api.gbif.org/v1/occurrence/search?taxonKey=2984',
      gbifSearchUrl: 'https://www.gbif.org/occurrence/search?taxon_key=2984',
      sqlCubeQuery: 'SELECT COUNT(*) FROM occurrence WHERE taxonKey = 2984',
      downloadPredicate: {
        type: 'and',
        predicates: [
          { type: 'equals', key: 'TAXON_KEY', value: '2984' },
          { type: 'equals', key: 'HAS_COORDINATE', value: 'true' },
        ],
      },
    },
    preview: {
      counts: {
        total: 1200,
        withCoordinates: 1100,
        withUsableCoordinates: 1000,
        withDate: 900,
        withCoordinatesAndDate: 850,
      },
      facets: {
        years: [{ name: '2024', count: 80 }],
        countries: [{ name: 'BD', count: 1200 }],
        datasets: [{ name: 'dataset-1', title: 'Bangladesh bird records', count: 700 }],
      },
      warnings: ['Preview warning example.'],
    },
    triage: {
      support: { headline: 'GBIF looks usable for cautious mapping.' },
      risks: [
        {
          level: 'MODERATE',
          title: 'Sampling bias',
          explanation: 'Records may cluster near accessible sites.',
        },
      ],
      recommendedFilters: ['Keep country and year filters explicit.'],
    },
  }
}

describe('createFallbackWorkflow', () => {
  it('creates every workflow export field without OpenAI output', () => {
    const payload = makePayload()
    const workflow = finalizeWorkflow(
      createFallbackWorkflow({
        ...payload,
        reason: 'OpenAI request timed out before it could complete.',
      }),
      payload,
    )

    expect(workflow.rCode).toContain('occ_search')
    expect(workflow.rCode).toContain('download_request_json <-')
    expect(workflow.rCode).toContain('fromJSON(download_request_json, simplifyVector = FALSE)')
    expect(workflow.rCode).toContain('\\"predicates\\"')
    expect(workflow.rCode).not.toContain('download_request <- list(')
    expect(workflow.pythonCode).toContain('requests.get')
    expect(workflow.cleaningR).toContain('gbif_occurrences_cleaned.csv')
    expect(workflow.cleaningR).toContain('requireNamespace("CoordinateCleaner"')
    expect(workflow.cleaningR).toContain('CoordinateCleaner::clean_coordinates')
    expect(workflow.cleaningR).toContain('CoordinateCleaner not installed')
    expect(workflow.methodsText).toContain('live GBIF occurrence-search preview')
    expect(workflow.limitationsText).toContain('deterministic export')
    expect(workflow.citationInstructions).toContain('GBIF download')
    expect(workflow.markdownReport).toContain('GBIF Workbench Report')
    expect(workflow.htmlReport).toContain('<html')
    expect(workflow.sqlCode).toBe(payload.query.sqlCubeQuery)
    expect(workflow.downloadRequestJson).toContain('SIMPLE_CSV')
    expect(workflow.jsonPlan).toContain('Alcedinidae')
  })
})
