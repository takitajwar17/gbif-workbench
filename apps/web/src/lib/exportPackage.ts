import JSZip from 'jszip'
import type { WorkflowPackage } from './types'

export async function createExportZip(workflow: WorkflowPackage) {
  const zip = new JSZip()
  zip.file('README.md', exportReadme())
  zip.file('study_plan.md', workflow.markdownReport)
  zip.file('study_plan.qmd', createQuartoNotebook(workflow))
  zip.file('study_plan.ipynb', createJupyterNotebook(workflow))
  zip.file('report.html', workflow.htmlReport)
  zip.file('data_availability_summary.json', workflow.jsonPlan)
  zip.file('gbif_download_request.json', workflow.downloadRequestJson)
  zip.file('gbif_download.R', workflow.rCode)
  zip.file('gbif_download.py', workflow.pythonCode)
  zip.file('gbif_occurrence_cube.sql', workflow.sqlCode)
  zip.file('cleaning_pipeline.R', workflow.cleaningR)
  zip.file('bias_checks.R', workflow.cleaningR)
  zip.file('methods_text.md', workflow.methodsText)
  zip.file('limitations_text.md', workflow.limitationsText)
  zip.file('citation_instructions.md', workflow.citationInstructions)
  return zip.generateAsync({ type: 'blob' })
}

export function createQuartoNotebook(workflow: WorkflowPackage) {
  return `---
title: "GBIF Workbench Workflow"
format: html
execute:
  warning: false
  message: false
---

# Study plan

${workflow.markdownReport}

# GBIF download workflow

\`\`\`{r}
${workflow.rCode}
\`\`\`

# Cleaning and bias checks

\`\`\`{r}
${workflow.cleaningR}
\`\`\`

# GBIF SQL occurrence-cube query

\`\`\`{sql}
${workflow.sqlCode}
\`\`\`

# GBIF predicate download request

\`\`\`{json}
${workflow.downloadRequestJson}
\`\`\`

# Citation instructions

${workflow.citationInstructions}

# Limitations

${workflow.limitationsText}
`
}

export function createJupyterNotebook(workflow: WorkflowPackage) {
  return JSON.stringify(
    {
      cells: [
        markdownCell(workflow.markdownReport),
        markdownCell('## GBIF preview and download workflow'),
        codeCell(workflow.pythonCode),
        markdownCell('## GBIF SQL occurrence-cube query'),
        codeCell(workflow.sqlCode),
        markdownCell('## GBIF predicate download request'),
        codeCell(workflow.downloadRequestJson),
        markdownCell('## Methods'),
        markdownCell(workflow.methodsText),
        markdownCell('## Citation instructions'),
        markdownCell(workflow.citationInstructions),
        markdownCell('## Limitations'),
        markdownCell(workflow.limitationsText),
      ],
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          pycodemirror_mode: { name: 'ipython', version: 3 },
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    2,
  )
}

function markdownCell(source: string) {
  return {
    cell_type: 'markdown',
    metadata: {},
    source: source.split('\n').map((line) => `${line}\n`),
  }
}

function codeCell(source: string) {
  return {
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: source.split('\n').map((line) => `${line}\n`),
  }
}

function exportReadme() {
  return `# GBIF Workbench Export

This package was generated from a live GBIF Workbench run.

Use the workflow files to reproduce the scoped GBIF query, request a DOI-backed GBIF download, clean records, and cite the resulting data. The JSON file contains the interpreted study scope, GBIF taxon resolution, aggregated preview, triage output, model metadata, and generated workflow text.
`
}
