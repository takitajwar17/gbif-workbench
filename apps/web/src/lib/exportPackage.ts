import type { GbifQuery, WorkflowPackage } from './types'

// Hoisted: `escapeHtml` and the markdown → HTML fragment serializer run
// over every line of the analysis summary (one of the slower text paths
// in the export pipeline). Building the regexes and Intl.NumberFormat
// once at module load is cheaper than allocating them on every call.
// See: js-hoist-regexp + js-cache-function-results in the Vercel
// React Best Practices.
const EXPORT_INTEGER_FORMAT = new Intl.NumberFormat()
const EXPORT_PERCENT_FORMAT = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })
const HTML_AMP = /&/g
const HTML_LT = /</g
const HTML_GT = />/g
const HTML_QUOT = /"/g

export async function createExportZip(workflow: WorkflowPackage, query: GbifQuery) {
  // Lazy-load jszip so its ~100KB stays out of the initial bundle. Only the
  // ZIP export button triggers this path; the other seven exports build
  // blobs directly and never need JSZip.
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const analysisSummary = createAnalysisSummary(workflow)
  // Ordered for a top-to-bottom workflow: read the report, inspect the
  // raw analysis, run the download (R or Python), then run cleaning,
  // then drop the methods/limitations/citation text into the manuscript.
  zip.file('README.md', exportReadme())
  zip.file('study_plan.md', withAnalysisAppendix(workflow.markdownReport, analysisSummary))
  zip.file('study_plan.qmd', createQuartoNotebook(workflow))
  zip.file('study_plan.ipynb', createJupyterNotebook(workflow))
  zip.file('report.html', createHtmlReport(workflow))
  zip.file('analysis_summary.md', analysisSummary)
  zip.file('complete_analysis.json', workflow.jsonPlan)
  zip.file('data_availability_summary.json', workflow.jsonPlan)
  zip.file('gbif_query_params.json', JSON.stringify(query.apiParams, null, 2))
  zip.file('gbif_download_request.json', workflow.downloadRequestJson)
  zip.file('gbif_download.R', workflow.rCode)
  zip.file('gbif_download.py', workflow.pythonCode)
  zip.file('gbif_occurrence_cube.sql', workflow.sqlCode)
  zip.file('cleaning_pipeline.R', workflow.cleaningR)
  zip.file('methods_text.md', workflow.methodsText)
  zip.file('limitations_text.md', workflow.limitationsText)
  zip.file('citation_instructions.md', workflow.citationInstructions)
  return zip.generateAsync({ type: 'blob' })
}

export function createQuartoNotebook(workflow: WorkflowPackage) {
  const analysisSummary = createAnalysisSummary(workflow)
  return `---
title: "GBIF Workbench Workflow"
format: html
execute:
  warning: false
  message: false
---

# Study plan

${workflow.markdownReport}

# Complete analysis appendix

${analysisSummary}

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
  const analysisSummary = createAnalysisSummary(workflow)
  return JSON.stringify(
    {
      cells: [
        markdownCell(workflow.markdownReport),
        markdownCell(analysisSummary),
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

export function createHtmlReport(workflow: WorkflowPackage) {
  const appendix = `<hr>\n<section aria-label="Complete analysis appendix">\n${markdownToHtmlFragment(createAnalysisSummary(workflow))}\n</section>`
  if (workflow.htmlReport.includes('</body>')) {
    return workflow.htmlReport.replace('</body>', `${appendix}\n</body>`)
  }
  return `${workflow.htmlReport}\n${appendix}`
}

export function createAnalysisSummary(workflow: WorkflowPackage) {
  const plan = parseJsonObject(workflow.jsonPlan)
  if (!plan) {
    return [
      '# Complete analysis appendix',
      '',
      'The raw analysis JSON could not be parsed. Use the generated workflow files and rerun the analysis if you need the full appendix.',
    ].join('\n')
  }

  const intent = objectValue(plan.intent)
  const taxon = objectValue(plan.taxon)
  const query = objectValue(plan.query)
  const preview = objectValue(plan.preview)
  const triage = objectValue(plan.triage)
  const support = objectValue(triage.support)
  const readiness = objectValue(triage.readiness)
  const facets = objectValue(preview.facets)
  const coordinateUncertainty = objectValue(preview.coordinateUncertainty)
  const samplingEvents = objectValue(preview.samplingEvents)
  const models = objectValue(plan.models)

  return [
    '# Complete analysis appendix',
    '',
    'This appendix is generated deterministically from the raw GBIF Workbench analysis state. It is included so the export is not limited to the generated prose report.',
    '',
    '## Run metadata',
    bullet('Generated at', stringValue(plan.generatedAt, 'Not recorded')),
    bullet('Intent model', stringValue(models.intent, 'Not recorded')),
    bullet('Triage model', stringValue(models.triage, 'Not recorded')),
    bullet('Workflow model', stringValue(models.workflow, 'Not recorded')),
    '',
    '## Interpreted scope',
    bullet('Question', stringValue(intent.question, 'Not supplied')),
    bullet('Taxon text', stringValue(intent.taxonText, 'Not supplied')),
    bullet('Taxon query', stringValue(intent.taxonQuery, 'Not supplied')),
    bullet('Taxonomic rank', stringValue(intent.taxonomicRank, 'Not supplied')),
    bullet('Region', stringValue(intent.regionText, 'Not supplied')),
    bullet('Countries', formatArray(intent.countries, 'Worldwide or unresolved')),
    bullet('Years', formatYears(intent.startYear, intent.endYear)),
    bullet('Analysis type', stringValue(intent.analysisType, 'unknown')),
    bullet('Claim type', stringValue(intent.claimType, 'Not supplied')),
    bullet('Required data', formatArray(intent.requiredData, 'Not supplied')),
    bullet('Possible extra data', formatArray(intent.possibleRequiredExtraData, 'None listed')),
    bullet('Spatial resolution', stringValue(intent.spatialResolution, 'Not supplied')),
    bullet('User skill level', stringValue(intent.skillLevel, 'Not supplied')),
    bullet('Preferred language', stringValue(intent.preferredLanguage, 'Both')),
    bullet('Interpretation confidence', formatNumberField(intent.confidence)),
    bullet('Ambiguities', formatArray(intent.ambiguities, 'None listed')),
    '',
    '## Taxon resolution',
    bullet('Scientific name', stringValue(taxon.scientificName, 'Not resolved')),
    bullet('Canonical name', stringValue(taxon.canonicalName, 'Not resolved')),
    bullet('Rank', stringValue(taxon.rank, 'UNKNOWN')),
    bullet('Status', stringValue(taxon.status, 'UNKNOWN')),
    bullet('Taxon key', formatNumberField(taxon.taxonKey)),
    bullet('Match confidence', formatNumberField(taxon.confidence)),
    bullet('Match type', stringValue(taxon.matchType, 'UNKNOWN')),
    bullet('Source name', stringValue(taxon.sourceName, 'Not supplied')),
    listSection('Alternative taxon matches', arrayValue(taxon.alternatives), formatTaxonAlternative, 'None returned'),
    '',
    '## Query and reproduction',
    bullet('GBIF.org search URL', stringValue(query.gbifSearchUrl, 'Not available')),
    bullet('GBIF API preview URL', stringValue(query.apiSearchUrl, 'Not available')),
    bullet('Preview query URL', stringValue(preview.queryUrl, 'Not available')),
    '### API parameters',
    jsonBlock(query.apiParams),
    '### Download predicate',
    jsonBlock(query.downloadPredicate),
    '### SQL cube query',
    codeBlock(stringValue(query.sqlCubeQuery, 'Not available'), 'sql'),
    '',
    '## Availability counts',
    ...countBullets(objectValue(preview.counts)),
    '',
    '## Readiness',
    bullet('Spatial', formatNumberField(readiness.spatial)),
    bullet('Temporal', formatNumberField(readiness.temporal)),
    bullet('Taxonomic', formatNumberField(readiness.taxonomic)),
    bullet('Data type', formatNumberField(readiness.dataType)),
    '',
    '## Support classification',
    bullet('Headline', stringValue(support.headline, 'Not supplied')),
    listSection('What GBIF can answer directly', arrayValue(support.stronglySupported), formatStringItem, 'None listed'),
    listSection('Conditionally supported', arrayValue(support.conditionallySupported), formatStringItem, 'None listed'),
    listSection('Exploratory only', arrayValue(support.exploratoryOnly), formatStringItem, 'None listed'),
    listSection('Not supported with occurrence-only data', arrayValue(support.notSupportedWithOccurrenceOnly), formatStringItem, 'None listed'),
    listSection('Insufficient data', arrayValue(support.insufficientData), formatStringItem, 'None listed'),
    '',
    '## Risks and mitigations',
    riskSection(arrayValue(triage.risks)),
    '',
    listSection('Recommended filters', arrayValue(triage.recommendedFilters), formatStringItem, 'None listed'),
    '',
    listSection('Unsupported claims', arrayValue(triage.unsupportedClaims), formatStringItem, 'None listed'),
    '',
    listSection('Next steps', arrayValue(triage.nextSteps), formatStringItem, 'None listed'),
    '',
    '## Preview facets',
    bucketSection('Years', arrayValue(facets.years), formatBucket),
    bucketSection('Countries', arrayValue(facets.countries), formatBucket),
    bucketSection('Basis of record', arrayValue(facets.basisOfRecord), formatBucket),
    bucketSection('Datasets', arrayValue(facets.datasets), formatDatasetBucket),
    bucketSection('GBIF issue flags', arrayValue(facets.issues), formatBucket),
    bucketSection('Taxa', arrayValue(facets.taxa), formatTaxonBucket),
    '',
    '## Coordinate uncertainty',
    bullet('Sampled records', formatNumberField(coordinateUncertainty.sampledRecords)),
    bullet('Records with uncertainty', formatNumberField(coordinateUncertainty.recordsWithUncertainty)),
    bullet('Median uncertainty meters', formatNumberField(coordinateUncertainty.medianMeters)),
    bullet('Share over 10 km', formatPercentField(coordinateUncertainty.over10kmShare)),
    '',
    '## Sampling-event signal',
    bullet('Countries checked', formatArray(samplingEvents.countriesChecked, 'Global')),
    bullet('Sampling-event dataset hits', formatNumberField(samplingEvents.datasetHits)),
    bullet('Note', stringValue(samplingEvents.note, 'Not supplied')),
    '',
    listSection('Sample georeferenced points', arrayValue(preview.samplePoints), formatSamplePoint, 'No sample points returned'),
    '',
    listSection('Preview warnings', arrayValue(preview.warnings), formatStringItem, 'None'),
    '',
    '## Raw files',
    '- `complete_analysis.json` contains the raw intent, taxon resolution, GBIF query, preview, triage, model metadata, and run timestamp.',
    '- `data_availability_summary.json` is kept as a backwards-compatible copy of the same raw analysis state.',
    '- Workflow code, SQL, predicate JSON, cleaning scripts, and manuscript text are included as separate export files.',
  ].filter((line) => line !== '').join('\n')
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

Use the workflow files to reproduce the scoped GBIF query, request a DOI-backed GBIF download, clean records, and cite the resulting data.

Recommended order:

1. Read \`study_plan.md\` or \`report.html\` for the human-readable interpretation, risks, and methods text.
2. Inspect \`analysis_summary.md\` for the deterministic appendix grounded in the live GBIF preview.
3. Pick \`gbif_download.R\` *or* \`gbif_download.py\` and run it. It submits a DOI-backed GBIF download via \`occ_download()\` (R) or the download API (Python), polls for completion, and writes \`gbif_occurrences.csv\` plus a \`gbif_doi.txt\` containing the returned DOI.
4. Run \`cleaning_pipeline.R\` against \`gbif_occurrences.csv\`.
5. Paste the DOI from \`gbif_doi.txt\` into \`citation_instructions.md\` and your manuscript methods section.

Files:

- \`analysis_summary.md\` — human-readable appendix generated from the raw analysis state.
- \`complete_analysis.json\` — full restorable snapshot (intent, taxon, query, preview, triage, workflow, models, timestamp).
- \`data_availability_summary.json\` — backwards-compatible copy of the same snapshot.
- \`gbif_query_params.json\` — exact GBIF occurrence/search parameters used for the preview.
- \`gbif_download_request.json\` — exact predicate body for the GBIF download API.
- \`gbif_download.R\` / \`gbif_download.py\` — submit, poll, and export the DOI-backed download.
- \`gbif_occurrence_cube.sql\` — SQL/cube starter query for advanced users.
- \`cleaning_pipeline.R\` — coordinate, date, and duplicate filters that read \`gbif_occurrences.csv\`.
- \`methods_text.md\` / \`limitations_text.md\` / \`citation_instructions.md\` — drop-in manuscript paragraphs.
- \`study_plan.qmd\` / \`study_plan.ipynb\` — runnable notebook equivalents of the workflow.
`
}

function withAnalysisAppendix(markdownReport: string, analysisSummary: string) {
  return `${markdownReport.trim()}\n\n---\n\n${analysisSummary}`
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    return objectValue(JSON.parse(value))
  } catch {
    return null
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function formatArray(value: unknown, fallback: string) {
  const items = arrayValue(value).map((item) => String(item)).filter(Boolean)
  return items.length ? items.join(', ') : fallback
}

function formatYears(start: unknown, end: unknown) {
  const startYear = numberValue(start)
  const endYear = numberValue(end)
  if (startYear !== null && endYear !== null) return `${startYear}-${endYear}`
  if (startYear !== null) return `${startYear}-present`
  if (endYear !== null) return `through ${endYear}`
  return 'Any year'
}

function formatNumberField(value: unknown) {
  const number = numberValue(value)
  return number === null ? 'Not available' : EXPORT_INTEGER_FORMAT.format(number)
}

function formatPercentField(value: unknown) {
  const number = numberValue(value)
  if (number === null) return 'Not available'
  return EXPORT_PERCENT_FORMAT.format(number)
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function bullet(label: string, value: string) {
  return `- ${label}: ${value}`
}

function countBullets(counts: Record<string, unknown>) {
  return [
    bullet('Matching records', formatNumberField(counts.total)),
    bullet('With coordinates', formatNumberField(counts.withCoordinates)),
    bullet('Usable coordinates', formatNumberField(counts.withUsableCoordinates)),
    bullet('With date', formatNumberField(counts.withDate)),
    bullet('With usable coordinates and date', formatNumberField(counts.withCoordinatesAndDate)),
  ]
}

function listSection(title: string, items: unknown[], formatter: (item: unknown, index: number) => string, empty: string) {
  return [`### ${title}`, ...(items.length ? items.map(formatter) : [`- ${empty}`])].join('\n')
}

function bucketSection(title: string, items: unknown[], formatter: (item: unknown, index: number) => string) {
  return listSection(title, items, formatter, 'None returned')
}

function riskSection(items: unknown[]) {
  if (!items.length) return '- None listed'
  return items.map((item, index) => {
    const risk = objectValue(item)
    return [
      `### ${index + 1}. ${stringValue(risk.title, 'Untitled risk')}`,
      bullet('Level', stringValue(risk.level, 'UNKNOWN')),
      bullet('Category', stringValue(risk.category, 'other')),
      bullet('Evidence', stringValue(risk.evidence, 'Not supplied')),
      bullet('Explanation', stringValue(risk.explanation, 'Not supplied')),
      bullet('Why it matters', stringValue(risk.whyItMatters, 'Not supplied')),
      bullet('Recommended mitigation', stringValue(risk.recommendedMitigation, 'Not supplied')),
      bullet('Workflow step', stringValue(risk.relatedWorkflowStep, 'Not supplied')),
    ].join('\n')
  }).join('\n')
}

function formatStringItem(item: unknown) {
  return `- ${String(item)}`
}

function formatBucket(item: unknown) {
  const bucket = objectValue(item)
  return `- ${stringValue(bucket.name, 'Unknown')}: ${formatNumberField(bucket.count)}`
}

function formatDatasetBucket(item: unknown) {
  const bucket = objectValue(item)
  const title = stringValue(bucket.title, stringValue(bucket.name, 'Unknown dataset'))
  const parts = [
    `${title}: ${formatNumberField(bucket.count)}`,
    stringValue(bucket.type, ''),
    stringValue(bucket.doi, ''),
  ].filter(Boolean)
  return `- ${parts.join(' | ')}`
}

function formatTaxonBucket(item: unknown) {
  const bucket = objectValue(item)
  return `- ${stringValue(bucket.name, stringValue(bucket.scientificName, 'Unknown taxon'))}: ${formatNumberField(bucket.count)}`
}

function formatTaxonAlternative(item: unknown) {
  const alternative = objectValue(item)
  return [
    `- ${stringValue(alternative.scientificName, 'Unknown taxon')}`,
    `rank ${stringValue(alternative.rank, 'UNKNOWN')}`,
    `taxonKey ${formatNumberField(alternative.taxonKey)}`,
    `status ${stringValue(alternative.status, 'UNKNOWN')}`,
  ].join(' | ')
}

function formatSamplePoint(item: unknown) {
  const point = objectValue(item)
  return [
    `- key ${formatNumberField(point.key)}`,
    `lat ${formatNumberField(point.lat)}`,
    `lon ${formatNumberField(point.lon)}`,
    `year ${formatNumberField(point.year)}`,
    `country ${stringValue(point.country, 'unknown')}`,
    `basis ${stringValue(point.basisOfRecord, 'unknown')}`,
    `taxon ${stringValue(point.scientificName, 'unknown')}`,
    `uncertainty_m ${formatNumberField(point.coordinateUncertaintyInMeters)}`,
  ].join(' | ')
}

function jsonBlock(value: unknown) {
  return codeBlock(JSON.stringify(value ?? null, null, 2), 'json')
}

function codeBlock(value: string, language: string) {
  return ['```' + language, value, '```'].join('\n')
}

function markdownToHtmlFragment(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`
      if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`
      if (line.startsWith('- ')) return `<p>${escapeHtml(line)}</p>`
      if (line.startsWith('```')) return `<pre>${escapeHtml(line)}</pre>`
      if (!line.trim()) return ''
      return `<p>${escapeHtml(line)}</p>`
    })
    .join('\n')
}

function escapeHtml(value: string) {
  return value
    .replace(HTML_AMP, '&amp;')
    .replace(HTML_LT, '&lt;')
    .replace(HTML_GT, '&gt;')
    .replace(HTML_QUOT, '&quot;')
}
