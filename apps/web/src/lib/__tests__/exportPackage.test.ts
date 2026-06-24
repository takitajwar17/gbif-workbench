import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createExportZip, createJupyterNotebook, createQuartoNotebook } from '../exportPackage'
import type { GbifQuery, WorkflowPackage } from '../types'

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
  jsonPlan: '{"ok":true}',
}

const query: GbifQuery = {
  apiParams: { taxonKey: 5219704, country: 'BR', year: '2000,2025' },
  apiSearchUrl: 'https://api.gbif.org/v1/occurrence/search',
  gbifSearchUrl: 'https://www.gbif.org/occurrence/search',
  sqlCubeQuery: 'SELECT 1',
  downloadPredicate: { format: 'SIMPLE_CSV' },
}

describe('createExportZip', () => {
  it('creates a complete export archive from generated workflow text', async () => {
    const blob = await createExportZip(workflow, query)
    expect(blob.size).toBeGreaterThan(100)
    expect(blob.type).toBe('application/zip')

    const archive = await JSZip.loadAsync(await blob.arrayBuffer())
    const expectedFiles = [
      'README.md',
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
    await expect(readZipText(archive, 'gbif_occurrence_cube.sql')).resolves.toContain('SELECT COUNT(*)')
    await expect(readZipText(archive, 'gbif_download_request.json')).resolves.toContain('SIMPLE_CSV')
    await expect(readZipText(archive, 'gbif_query_params.json')).resolves.toContain('"taxonKey": 5219704')
    await expect(readZipText(archive, 'citation_instructions.md')).resolves.toContain('Citation instructions')
    await expect(readZipText(archive, 'README.md')).resolves.toContain('GBIF Workbench Export')
    await expect(readZipText(archive, 'study_plan.qmd')).resolves.toContain('GBIF predicate download request')
  })

  it('creates notebook-style exports from workflow text', () => {
    expect(createQuartoNotebook(workflow)).toContain('title: "GBIF Workbench Workflow"')
    expect(createQuartoNotebook(workflow)).toContain('```{r}')
    expect(createQuartoNotebook(workflow)).toContain('```{sql}')
    expect(createQuartoNotebook(workflow)).toContain('```{json}')

    const notebook = JSON.parse(createJupyterNotebook(workflow)) as { nbformat: number; cells: { cell_type: string }[] }
    expect(notebook.nbformat).toBe(4)
    expect(notebook.cells.some((cell) => cell.cell_type === 'code')).toBe(true)
  })
})

async function readZipText(archive: JSZip, filename: string) {
  const file = archive.file(filename)
  expect(file).not.toBeNull()
  return file!.async('string')
}
