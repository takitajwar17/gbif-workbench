import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createAnalysisSummary, createExportZip, createHtmlReport, createJupyterNotebook, createQuartoNotebook } from '../exportPackage'
import type { GbifQuery, WorkflowPackage } from '../types'

const query: GbifQuery = {
  apiParams: { taxonKey: 5219704, country: 'BR', year: '2000,2025' },
  apiSearchUrl: 'https://api.gbif.org/v1/occurrence/search',
  gbifSearchUrl: 'https://www.gbif.org/occurrence/search',
  sqlCubeQuery: 'SELECT 1',
  downloadPredicate: { format: 'SIMPLE_CSV' },
}

const workflow: WorkflowPackage = {
  rCode: 'library(rgbif)',
  pythonCode: 'from pygbif import occurrences',
  sqlCode: 'SELECT COUNT(*) FROM occurrence',
  downloadRequestJson: '{"format":"SIMPLE_CSV"}',
  cleaningR: 'clean_occurrences <- function(x) x',
  methodsText: 'Methods text',
  limitationsText: 'Limitations text',
  citationInstructions: 'Citation instructions',
  markdownReport: '# Report',
  htmlReport: '<h1>Report</h1>',
  jsonPlan: JSON.stringify({
    generatedAt: '2026-06-26T00:00:00.000Z',
    models: {
      intent: 'gpt-5.4-mini',
      triage: 'deterministic-preview-fallback',
      workflow: 'deterministic-workflow-fallback',
    },
    intent: {
      question: 'Can GBIF occurrence records support mapping jaguars in Brazil since 2000?',
      taxonText: 'Jaguar',
      taxonQuery: 'Panthera onca',
      taxonomicRank: 'SPECIES',
      regionText: 'Brazil',
      countries: ['BR'],
      startYear: 2000,
      endYear: 2026,
      analysisType: 'distribution_mapping',
      claimType: 'range',
      requiredData: ['occurrences', 'coordinates'],
      possibleRequiredExtraData: ['environmental covariates'],
      spatialResolution: 'country',
      skillLevel: 'intermediate',
      preferredLanguage: 'Both',
      confidence: 0.9,
      ambiguities: [],
    },
    taxon: {
      scientificName: 'Panthera onca',
      canonicalName: 'Panthera onca',
      rank: 'SPECIES',
      status: 'ACCEPTED',
      taxonKey: 5219404,
      confidence: 99,
      matchType: 'EXACT',
      sourceName: 'Jaguar',
      alternatives: [],
    },
    query,
    preview: {
      counts: {
        total: 1000,
        withCoordinates: 900,
        withUsableCoordinates: 850,
        withDate: 800,
        withCoordinatesAndDate: 750,
      },
      facets: {
        years: [{ name: '2025', count: 50 }],
        countries: [{ name: 'BR', count: 1000 }],
        basisOfRecord: [{ name: 'HUMAN_OBSERVATION', count: 600 }],
        datasets: [{ name: 'dataset-1', title: 'Jaguar dataset', count: 500, doi: '10.15468/example' }],
        issues: [{ name: 'COORDINATE_ROUNDED', count: 30 }],
        taxa: [{ name: 'Panthera onca', count: 1000 }],
      },
      samplePoints: [{ key: 1, lat: -10.2, lon: -52.3, year: 2025, country: 'BR', basisOfRecord: 'HUMAN_OBSERVATION', scientificName: 'Panthera onca' }],
      coordinateUncertainty: { sampledRecords: 1, recordsWithUncertainty: 1, medianMeters: 1000, over10kmShare: 0.1 },
      samplingEvents: { countriesChecked: ['BR'], datasetHits: 4, note: 'Sampling-event signal.' },
      queryUrl: 'https://api.gbif.org/v1/occurrence/search',
      fetchedAt: '2026-06-26T00:00:00.000Z',
      warnings: ['Review coordinate uncertainty.'],
    },
    triage: {
      support: {
        headline: 'GBIF looks usable for cautious mapping.',
        stronglySupported: ['Data discovery'],
        conditionallySupported: ['Distribution mapping'],
        exploratoryOnly: [],
        notSupportedWithOccurrenceOnly: [],
        insufficientData: [],
      },
      risks: [{
        category: 'spatial',
        level: 'MODERATE',
        title: 'Spatial bias',
        explanation: 'Records cluster near accessible places.',
        evidence: 'Country facets and sample points show clustering.',
        whyItMatters: 'Spatial clustering can bias maps.',
        recommendedMitigation: 'Review sampling bias before modelling.',
        relatedWorkflowStep: 'Coordinate cleaning',
      }],
      readiness: { spatial: 80, temporal: 75, taxonomic: 95, dataType: 70 },
      recommendedFilters: ['Require usable coordinates.'],
      unsupportedClaims: ['Population abundance claims need extra data.'],
      nextSteps: ['Create a DOI-backed GBIF download.'],
    },
  }),
}

describe('createExportZip', () => {
  it('creates a complete export archive from generated workflow text', async () => {
    const blob = await createExportZip(workflow, query)
    expect(blob.size).toBeGreaterThan(100)
    expect(blob.type).toBe('application/zip')

    const archive = await JSZip.loadAsync(await blob.arrayBuffer())
    const expectedFiles = [
      'README.md',
      'analysis_summary.md',
      'complete_analysis.json',
      'study_plan.md',
      'study_plan.qmd',
      'study_plan.ipynb',
      'report.html',
      'data_availability_summary.json',
      'gbif_query_params.json',
      'gbif_download_request.json',
      'gbif_download.R',
      'gbif_download.py',
      'gbif_occurrence_cube.sql',
      'cleaning_pipeline.R',
      'methods_text.md',
      'limitations_text.md',
      'citation_instructions.md',
    ]

    expect(Object.keys(archive.files).sort()).toEqual(expectedFiles.sort())
    await expect(readZipText(archive, 'analysis_summary.md')).resolves.toContain('Complete analysis appendix')
    await expect(readZipText(archive, 'analysis_summary.md')).resolves.toContain('Spatial bias')
    await expect(readZipText(archive, 'analysis_summary.md')).resolves.toContain('deterministic-workflow-fallback')
    await expect(readZipText(archive, 'complete_analysis.json')).resolves.toContain('"generatedAt"')
    await expect(readZipText(archive, 'study_plan.md')).resolves.toContain('Complete analysis appendix')
    await expect(readZipText(archive, 'report.html')).resolves.toContain('Complete analysis appendix')
    await expect(readZipText(archive, 'gbif_occurrence_cube.sql')).resolves.toContain('SELECT COUNT(*)')
    await expect(readZipText(archive, 'gbif_download_request.json')).resolves.toContain('SIMPLE_CSV')
    await expect(readZipText(archive, 'gbif_query_params.json')).resolves.toContain('"taxonKey": 5219704')
    await expect(readZipText(archive, 'citation_instructions.md')).resolves.toContain('Citation instructions')
    await expect(readZipText(archive, 'README.md')).resolves.toContain('GBIF Workbench Export')
    await expect(readZipText(archive, 'study_plan.qmd')).resolves.toContain('GBIF predicate download request')
  })

  it('creates notebook-style exports from workflow text', () => {
    expect(createQuartoNotebook(workflow)).toContain('title: "GBIF Workbench Workflow"')
    expect(createQuartoNotebook(workflow)).toContain('Complete analysis appendix')
    expect(createQuartoNotebook(workflow)).toContain('```{r}')
    expect(createQuartoNotebook(workflow)).toContain('```{sql}')
    expect(createQuartoNotebook(workflow)).toContain('```{json}')

    const notebook = JSON.parse(createJupyterNotebook(workflow)) as { nbformat: number; cells: { cell_type: string }[] }
    expect(notebook.nbformat).toBe(4)
    expect(notebook.cells.some((cell) => cell.cell_type === 'code')).toBe(true)
    expect(createHtmlReport(workflow)).toContain('Complete analysis appendix')
  })

  it('creates a deterministic analysis summary from raw analysis JSON', () => {
    const summary = createAnalysisSummary(workflow)
    expect(summary).toContain('Jaguar')
    expect(summary).toContain('Panthera onca')
    expect(summary).toContain('Spatial bias')
    expect(summary).toContain('Require usable coordinates.')
    expect(summary).toContain('Review coordinate uncertainty.')
  })
})

async function readZipText(archive: JSZip, filename: string) {
  const file = archive.file(filename)
  expect(file).not.toBeNull()
  return file!.async('string')
}
