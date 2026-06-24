import { describe, expect, it } from 'vitest'
import { createExportZip, createJupyterNotebook, createQuartoNotebook } from '../exportPackage'
import type { WorkflowPackage } from '../types'

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

describe('createExportZip', () => {
  it('creates a non-empty export archive from generated workflow text', async () => {
    const blob = await createExportZip(workflow)
    expect(blob.size).toBeGreaterThan(100)
    expect(blob.type).toBe('application/zip')
  })

  it('creates notebook-style exports from workflow text', () => {
    expect(createQuartoNotebook(workflow)).toContain('```{r}')
    expect(createQuartoNotebook(workflow)).toContain('```{sql}')
    expect(createQuartoNotebook(workflow)).toContain('```{json}')

    const notebook = JSON.parse(createJupyterNotebook(workflow)) as { nbformat: number; cells: { cell_type: string }[] }
    expect(notebook.nbformat).toBe(4)
    expect(notebook.cells.some((cell) => cell.cell_type === 'code')).toBe(true)
  })
})
