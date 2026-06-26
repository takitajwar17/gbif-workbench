#!/usr/bin/env node
//
// Build static example export ZIPs from deterministic workflow output.
// These ZIPs get committed under examples/ so judges can inspect the
// submission artifact quality without booting the app or hitting GBIF.
//
// Usage:
//   node scripts/build-examples.mjs           # writes examples/*.zip
//
// The script mirrors what the browser's createExportZip() does — same
// file list, same content recipes — but assembles the ZIP from
// server-side inputs. This is the deterministic path (no OpenAI call),
// which is the strongest static guarantee of the package shape.

import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import JSZip from 'jszip'

import { createFallbackWorkflow } from '../server/lib/fallbackWorkflow.js'
import { finalizeWorkflow } from '../server/workflow.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// __dirname = apps/web/scripts, so ../../../examples = repo-root/examples
const examplesDir = path.resolve(__dirname, '../../../examples')

// Two showcase fixtures:
//   1. Jaguar in Brazil — distribution-mapping, expected to be supported.
//      Demonstrates the full "strong support" export with cleaning,
//      CoordinateCleaner, citation guidance, and DOI-backed download.
//   2. Frog population decline — occurrence-only mismatch, expected to
//      redirect the user toward sampling-event / monitoring data.
//      Demonstrates the refusal / redirect export.
const FIXTURES = [
  {
    filename: 'jaguar-brazil-supported.zip',
    label: 'Jaguar in Brazil — distribution mapping (supported)',
    fixture: {
      intent: {
        question: 'Can GBIF support mapping jaguar (Panthera onca) records in Brazil since 2000?',
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
        confidence: 0.92,
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
      query: {
        apiParams: {
          taxonKey: 5219404,
          country: ['BR'],
          year: '2000,2026',
          hasCoordinate: true,
          hasGeospatialIssue: false,
        },
        apiSearchUrl: 'https://api.gbif.org/v1/occurrence/search?taxonKey=5219404&country=BR&year=2000%2C2026',
        gbifSearchUrl: 'https://www.gbif.org/occurrence/search?taxon_key=5219404&country=BR&year=2000%2C2026',
        sqlCubeQuery:
          "SELECT taxonKey, decimalLatitude, decimalLongitude, year FROM occurrence WHERE taxonKey = 5219404 AND countryCode = 'BR' AND year BETWEEN 2000 AND 2026",
        downloadPredicate: {
          type: 'and',
          predicates: [
            { type: 'equals', key: 'TAXON_KEY', value: '5219404' },
            { type: 'equals', key: 'COUNTRY', value: 'BR' },
            { type: 'equals', key: 'YEAR', value: '2000,2026' },
          ],
        },
      },
      preview: {
        counts: { total: 4382, withCoordinates: 3910, withUsableCoordinates: 3602, withDate: 3881, withCoordinatesAndDate: 3505 },
        facets: {
          years: [
            { name: '2024', count: 187 },
            { name: '2023', count: 213 },
            { name: '2022', count: 198 },
          ],
          countries: [{ name: 'BR', count: 4382 }],
          basisOfRecord: [
            { name: 'HUMAN_OBSERVATION', count: 2621 },
            { name: 'MACHINE_OBSERVATION', count: 1102 },
          ],
          datasets: [
            { name: 'dat-1', title: 'Jaguar camera-trap surveys', count: 1820, doi: '10.15468/example1' },
            { name: 'dat-2', title: 'Brazilian mammal atlas', count: 1102, doi: '10.15468/example2' },
          ],
          issues: [
            { name: 'COORDINATE_ROUNDED', count: 38 },
            { name: 'ZERO_COORDINATE', count: 4 },
          ],
          taxa: [{ name: 'Panthera onca', count: 4382 }],
        },
        samplePoints: [
          { key: 1, lat: -10.2, lon: -52.3, year: 2024, country: 'BR', basisOfRecord: 'HUMAN_OBSERVATION', scientificName: 'Panthera onca' },
          { key: 2, lat: -14.8, lon: -39.1, year: 2023, country: 'BR', basisOfRecord: 'MACHINE_OBSERVATION', scientificName: 'Panthera onca' },
        ],
        coordinateUncertainty: { sampledRecords: 2, recordsWithUncertainty: 2, medianMeters: 1000, over10kmShare: 0.12 },
        samplingEvents: { countriesChecked: ['BR'], datasetHits: 2, note: 'Sampling-event signal detected.' },
        queryUrl:
          'https://api.gbif.org/v1/occurrence/search?taxonKey=5219404&country=BR&year=2000%2C2026',
        fetchedAt: '2026-06-26T00:00:00.000Z',
        warnings: ['Review coordinate uncertainty before modelling.'],
      },
      triage: {
        support: {
          headline: 'GBIF looks usable for cautious mapping of jaguar records in Brazil since 2000.',
          stronglySupported: ['Data discovery', 'Distribution mapping'],
          conditionallySupported: ['Range-shift inference (with explicit bias caveat)'],
          exploratoryOnly: [],
          notSupportedWithOccurrenceOnly: ['Population abundance', 'Survival or mortality rates'],
          insufficientData: [],
        },
        risks: [
          {
            category: 'spatial',
            level: 'MODERATE',
            title: 'Sampling bias',
            explanation: 'Records cluster near accessible sites.',
            evidence: 'Sample points cluster in southeastern Brazil; camera-trap datasets dominate.',
            whyItMatters: 'Spatial clustering can bias downstream species distribution models.',
            recommendedMitigation: 'Review sampling bias before modelling; consider background-point thinning.',
            relatedWorkflowStep: 'Coordinate cleaning',
          },
        ],
        readiness: { spatial: 80, temporal: 75, taxonomic: 95, dataType: 70 },
        recommendedFilters: ['Require usable coordinates (coordinateUncertaintyInMeters <= 10000).'],
        unsupportedClaims: ['Population abundance claims need monitoring data not present in GBIF.'],
        nextSteps: ['Create a DOI-backed GBIF download via occ_download().'],
      },
    },
  },
  {
    filename: 'frog-bangladesh-redirect.zip',
    label: 'Frog population decline in Bangladesh — occurrence-only mismatch (redirect)',
    fixture: {
      intent: {
        question: 'Are frog populations declining in Bangladesh since 2000?',
        taxonText: 'Frogs',
        taxonQuery: 'Anura',
        taxonomicRank: 'ORDER',
        regionText: 'Bangladesh',
        countries: ['BD'],
        startYear: 2000,
        endYear: 2026,
        analysisType: 'population_trend',
        claimType: 'abundance_trend',
        requiredData: ['occurrences', 'abundance', 'monitoring'],
        possibleRequiredExtraData: ['sampling effort', 'repeated surveys'],
        spatialResolution: 'country',
        skillLevel: 'intermediate',
        preferredLanguage: 'Both',
        confidence: 0.88,
        ambiguities: ['Decline requires repeated surveys, not just presence counts'],
      },
      taxon: {
        scientificName: 'Anura',
        canonicalName: 'Anura',
        rank: 'ORDER',
        status: 'ACCEPTED',
        taxonKey: 106,
        confidence: 97,
        matchType: 'EXACT',
        sourceName: 'Frogs',
        alternatives: [],
      },
      query: {
        apiParams: {
          taxonKey: 106,
          country: ['BD'],
          year: '2000,2026',
          hasCoordinate: true,
        },
        apiSearchUrl:
          'https://api.gbif.org/v1/occurrence/search?taxonKey=106&country=BD&year=2000%2C2026',
        gbifSearchUrl: 'https://www.gbif.org/occurrence/search?taxon_key=106&country=BD&year=2000%2C2026',
        sqlCubeQuery:
          "SELECT taxonKey, year, countryCode FROM occurrence WHERE taxonKey = 106 AND countryCode = 'BD' AND year BETWEEN 2000 AND 2026",
        downloadPredicate: {
          type: 'and',
          predicates: [
            { type: 'equals', key: 'TAXON_KEY', value: '106' },
            { type: 'equals', key: 'COUNTRY', value: 'BD' },
            { type: 'equals', key: 'YEAR', value: '2000,2026' },
          ],
        },
      },
      preview: {
        counts: { total: 312, withCoordinates: 280, withUsableCoordinates: 240, withDate: 305, withCoordinatesAndDate: 230 },
        facets: {
          years: [
            { name: '2024', count: 8 },
            { name: '2023', count: 11 },
            { name: '2020', count: 18 },
            { name: '2010', count: 42 },
          ],
          countries: [{ name: 'BD', count: 312 }],
          basisOfRecord: [
            { name: 'HUMAN_OBSERVATION', count: 198 },
            { name: 'PRESERVED_SPECIMEN', count: 90 },
          ],
          datasets: [
            { name: 'dat-bd', title: 'Bangladesh biodiversity surveys', count: 198, doi: '10.15468/exampleBD' },
          ],
          issues: [{ name: 'COORDINATE_ROUNDED', count: 30 }],
          taxa: [{ name: 'Anura', count: 312 }],
        },
        samplePoints: [
          { key: 1, lat: 23.8, lon: 90.4, year: 2010, country: 'BD', basisOfRecord: 'HUMAN_OBSERVATION', scientificName: 'Anura' },
        ],
        coordinateUncertainty: { sampledRecords: 1, recordsWithUncertainty: 1, medianMeters: 5000, over10kmShare: 0.4 },
        samplingEvents: { countriesChecked: ['BD'], datasetHits: 0, note: 'No sampling-event signal detected for this scope.' },
        queryUrl:
          'https://api.gbif.org/v1/occurrence/search?taxonKey=106&country=BD&year=2000%2C2026',
        fetchedAt: '2026-06-26T00:00:00.000Z',
        warnings: ['No sampling-event signal for this scope; consider sampling-event datasets for population work.'],
      },
      triage: {
        support: {
          headline: 'GBIF occurrences alone cannot answer a population-trend question. Re-cast as exploratory data discovery, then seek monitoring or sampling-event data.',
          stronglySupported: ['Data discovery (species list, locations, dates)'],
          conditionallySupported: ['Range / distribution mapping'],
          exploratoryOnly: ['General diversity comparisons'],
          notSupportedWithOccurrenceOnly: ['Population decline', 'Abundance trends', 'Mortality', 'Reproductive success'],
          insufficientData: [],
        },
        risks: [
          {
            category: 'dataType',
            level: 'HIGH',
            title: 'Occurrence-only mismatch',
            explanation: 'A decline claim requires repeated surveys, sampling effort, and abundance or absence data. GBIF occurrences record presence, not population size.',
            evidence: 'No sampling-event datasets matched this scope. Coordinate uncertainty is high (median 5km). Records concentrate in 2010 and drop sharply after — likely a sampling-effort artefact, not a real trend.',
            whyItMatters: 'Inferring population trends from opportunistic presence records systematically overestimates decline.',
            recommendedMitigation: 'Pair with a sampling-event dataset (e.g. GBIF sampling-event endpoint), a long-term monitoring programme, or an amphibian-specific atlas.',
            relatedWorkflowStep: 'Re-cast study design',
          },
        ],
        readiness: { spatial: 60, temporal: 50, taxonomic: 80, dataType: 25 },
        recommendedFilters: ['Filter to known monitoring programmes if available.'],
        unsupportedClaims: ['Population decline, abundance trends, mortality, reproductive success — none of these can be supported by GBIF occurrence records alone.'],
        nextSteps: ['Search GBIF sampling-event endpoint for amphibian monitoring in Bangladesh.', 'Pair with IUCN Red List assessment or national biodiversity atlas data.'],
      },
    },
  },
]

// Mirror of apps/web/src/lib/exportPackage.ts → createAnalysisSummary.
// We keep this in sync rather than reaching into TS so the script
// stays a plain Node ESM file with no transpile step.
function createAnalysisSummary(workflow) {
  const plan = JSON.parse(workflow.jsonPlan || '{}')
  const intent = plan.intent || {}
  const taxon = plan.taxon || {}
  const preview = plan.preview || {}
  const triage = plan.triage || {}
  const counts = preview.counts || {}
  const risks = Array.isArray(triage.risks) ? triage.risks : []
  const filters = Array.isArray(triage.recommendedFilters) ? triage.recommendedFilters : []
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : []
  const integerFormat = new Intl.NumberFormat('en')

  const lines = []
  lines.push('# Complete analysis appendix')
  lines.push('')
  lines.push(`Generated by GBIF Workbench. Models in this run: ${JSON.stringify(plan.models || {})}.`)
  lines.push('')
  lines.push('## Study question and interpreted scope')
  lines.push(`- Question: ${intent.question || 'Not supplied'}`)
  lines.push(`- Taxon: ${taxon.scientificName || intent.taxonText || 'Unspecified'}`)
  lines.push(`- Region: ${intent.regionText || 'Worldwide or unresolved region'}`)
  lines.push(`- Years: ${intent.startYear || '?'}–${intent.endYear || '?'}`)
  lines.push(`- Analysis type: ${intent.analysisType || 'unknown'}`)
  lines.push('')
  lines.push('## Live GBIF preview')
  lines.push(`- Matching records: ${integerFormat.format(counts.total || 0)}`)
  lines.push(`- Records with usable coordinates: ${integerFormat.format(counts.withUsableCoordinates || 0)}`)
  lines.push(`- Records with date information: ${integerFormat.format(counts.withDate || 0)}`)
  lines.push('')
  if (triage.support?.headline) {
    lines.push('## Support verdict')
    lines.push(triage.support.headline)
    lines.push('')
  }
  if (risks.length > 0) {
    lines.push('## Main risks')
    for (const risk of risks) {
      lines.push(`- ${risk.level || ''}: ${risk.title} - ${risk.explanation || ''}`)
    }
    lines.push('')
  }
  if (filters.length > 0) {
    lines.push('## Recommended filters')
    for (const filter of filters) lines.push(`- ${filter}`)
    lines.push('')
  }
  if (warnings.length > 0) {
    lines.push('## Preview warnings')
    for (const warning of warnings) lines.push(`- ${warning}`)
    lines.push('')
  }
  return lines.join('\n')
}

function markdownToHtmlFragment(markdown) {
  const escape = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return String(markdown)
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escape(line.slice(2))}</h1>`
      if (line.startsWith('## ')) return `<h2>${escape(line.slice(3))}</h2>`
      if (line.startsWith('- ')) return `<p>${escape(line)}</p>`
      if (!line.trim()) return ''
      return `<p>${escape(line)}</p>`
    })
    .join('\n')
}

function createQuartoNotebook(workflow) {
  const summary = createAnalysisSummary(workflow)
  return `---
title: "GBIF Workbench Workflow"
format: html
---

\`\`\`{r}
# R download script — see gbif_download.R for the full content.
\`\`\`

\`\`\`{python}
# Python download script — see gbif_download.py for the full content.
\`\`\`

\`\`\`{sql}
${workflow.sqlCode || ''}
\`\`\`

\`\`\`{json}
${workflow.downloadRequestJson || '{}'}
\`\`\`

${summary}
`
}

function createJupyterNotebook(workflow) {
  const cells = []
  cells.push({ cell_type: 'markdown', metadata: {}, source: ['# GBIF Workbench Workflow\n'] })
  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: ['This notebook reproduces the GBIF Workbench workflow for the question below. Run the R or Python cell to download (requires GBIF credentials); then run the SQL and JSON cells to inspect the predicate request.\n'],
  })
  cells.push({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: ['# R download — see gbif_download.R\n'] })
  cells.push({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: ['# Python download — see gbif_download.py\n'] })
  cells.push({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: [String(workflow.sqlCode || '') + '\n'] })
  cells.push({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: [String(workflow.downloadRequestJson || '{}') + '\n'] })
  cells.push({ cell_type: 'markdown', metadata: {}, source: [createAnalysisSummary(workflow).split('\n').map((l) => l + '\n')] })
  return JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' } },
    cells,
  }, null, 2)
}

function createHtmlReport(workflow) {
  const fragment = markdownToHtmlFragment(createAnalysisSummary(workflow))
  const fullReport = markdownToHtmlFragment(workflow.markdownReport || '')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GBIF Workbench Report</title>
</head>
<body>
${fullReport}
<hr>
<section aria-label="Complete analysis appendix">
${fragment}
</section>
</body>
</html>
`
}

function exportReadme() {
  return `# GBIF Workbench Export

This archive is the export package produced by GBIF Workbench.

## Recommended order of operations

1. Read \`study_plan.md\` (or \`study_plan.qmd\` / \`study_plan.ipynb\`) for the
   complete workflow outline, including the interpreted scope, GBIF
   preview, triage, and recommended next steps.
2. Edit \`gbif_query_params.json\` if you need to adjust taxon, country,
   or year filters before submitting the download request.
3. Set your GBIF credentials (GBIF_USER, GBIF_PWD, GBIF_EMAIL) and
   run \`gbif_download.R\` or \`gbif_download.py\`. This submits a
   DOI-backed GBIF download and writes \`gbif_doi.txt\` and
   \`gbif_occurrences.csv\` for the cleaning pipeline.
4. Run \`cleaning_pipeline.R\` to produce \`gbif_occurrences_cleaned.csv\`.
   CoordinateCleaner is run automatically when installed; otherwise
   the script prints an install hint.
5. Paste the DOI from \`gbif_doi.txt\` into \`citation_instructions.md\`
   and your manuscript methods section.

## Important

The browser preview that produced this archive is *not* DOI-backed.
The DOI is generated when you run \`gbif_download.R\` or
\`gbif_download.py\` against the GBIF download API with your
credentials. Always cite the DOI, not the preview URL.

GBIF occurrence records are presence-only and opportunistic. The
methods, limitations, and triage text in this archive are starting
points, not a substitute for review of the GBIF issue facets and
coordinate-uncertainty signal that the workbench reports.

See \`limitations_text.md\` for the full list of caveats that apply
to your study.
`
}

async function buildOne(fixture, payload) {
  const workflow = finalizeWorkflow(
    createFallbackWorkflow({ ...fixture, reason: 'examples/ static export' }),
    payload,
  )
  const zip = new JSZip()
  const analysisSummary = createAnalysisSummary(workflow)
  zip.file('README.md', exportReadme())
  zip.file('study_plan.md', `${workflow.markdownReport}\n\n${analysisSummary}\n`)
  zip.file('study_plan.qmd', createQuartoNotebook(workflow))
  zip.file('study_plan.ipynb', createJupyterNotebook(workflow))
  zip.file('report.html', createHtmlReport(workflow))
  zip.file('analysis_summary.md', analysisSummary)
  zip.file('complete_analysis.json', workflow.jsonPlan)
  zip.file('data_availability_summary.json', workflow.jsonPlan)
  zip.file('gbif_query_params.json', JSON.stringify(fixture.query.apiParams, null, 2))
  zip.file('gbif_download_request.json', workflow.downloadRequestJson)
  zip.file('gbif_download.R', workflow.rCode)
  zip.file('gbif_download.py', workflow.pythonCode)
  zip.file('gbif_occurrence_cube.sql', workflow.sqlCode)
  zip.file('cleaning_pipeline.R', workflow.cleaningR)
  zip.file('methods_text.md', workflow.methodsText)
  zip.file('limitations_text.md', workflow.limitationsText)
  zip.file('citation_instructions.md', workflow.citationInstructions)
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function main() {
  await mkdir(examplesDir, { recursive: true })
  for (const { filename, label, fixture } of FIXTURES) {
    const payload = {
      ...fixture,
      models: { intent: 'deterministic-example', triage: 'deterministic-example', workflow: 'deterministic-example' },
      generatedAt: '2026-06-26T00:00:00.000Z',
    }
    const buffer = await buildOne(fixture, payload)
    const target = path.join(examplesDir, filename)
    await writeFile(target, buffer)
    process.stdout.write(`wrote ${filename} (${label}) — ${buffer.length} bytes\n`)
  }
}

main().catch((error) => {
  console.error('[build-examples]', error)
  process.exit(1)
})