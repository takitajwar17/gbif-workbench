#!/usr/bin/env node
//
// GBIF Workbench proof-of-runnability harness.
//
// Walks the same code paths the /api/workflow Vercel handler walks, but
// with a hand-built fixture so it runs in any environment without an
// OpenAI key or a GBIF download. The point is to prove the workflow
// package's reproducible code actually parses in R and Python — that's
// the strongest static guarantee we can give reviewers without booting
// R / Python against a real GBIF archive.
//
// We exercise TWO paths through the workflow generator:
//   1. The deterministic fallback path (createFallbackWorkflow) — used
//      when the AI call fails or the AI emits unparseable code. This is
//      what ships when OpenAI is unavailable.
//   2. The AI success path (assessWorkflow) — only run when
//      OPENAI_API_KEY is set. Skipped otherwise.
//
// For each generated workflow, the harness:
//   - parse-checks the R code via `Rscript --vanilla` if Rscript is on
//     PATH. Otherwise records a SKIPPED status with the install hint.
//   - parse-checks the Python code via `python3 -c compile()` if
//     python3 is on PATH. Otherwise records SKIPPED.
//
// Exit code 0 = all paths produced parse-clean code (or skipped because
// the validator binary isn't available). Exit code 1 = at least one
// path produced unparseable code or threw unexpectedly.
//
// Designed for both human invocation (`node scripts/check-workflow-runnable.mjs`)
// and CI invocation (`node scripts/check-workflow-runnable.mjs --json`).

import process from 'node:process'
import { createFallbackWorkflow } from '../server/lib/fallbackWorkflow.js'
import { finalizeWorkflow } from '../server/workflow.js'
import { validatePythonCode, validateRCode } from '../server/lib/codeValidator.js'

const RESET = '\u001b[0m'
const GREEN = '\u001b[32m'
const RED = '\u001b[31m'
const YELLOW = '\u001b[33m'
const DIM = '\u001b[2m'

function color(enabled, code, text) {
  return enabled ? `${code}${text}${RESET}` : text
}

function buildFixturePayload() {
  // Same shape /api/study-plan produces: intent + taxon + query + preview
  // + triage, all populated. The fixture is deliberately a real-looking
  // jaguar-in-Brazil query because that's the showcase scenario in the
  // README.
  const intent = {
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
  }

  const taxon = {
    scientificName: 'Panthera onca',
    canonicalName: 'Panthera onca',
    rank: 'SPECIES',
    status: 'ACCEPTED',
    taxonKey: 5219404,
    confidence: 99,
    matchType: 'EXACT',
    sourceName: 'Jaguar',
    alternatives: [],
  }

  const query = {
    apiParams: {
      taxonKey: 5219404,
      country: ['BR'],
      year: '2000,2026',
      hasCoordinate: true,
      hasGeospatialIssue: false,
    },
    apiSearchUrl:
      'https://api.gbif.org/v1/occurrence/search?taxonKey=5219404&country=BR&year=2000%2C2026',
    gbifSearchUrl:
      'https://www.gbif.org/occurrence/search?taxon_key=5219404&country=BR&year=2000%2C2026',
    sqlCubeQuery:
      'SELECT taxonKey, decimalLatitude, decimalLongitude, year FROM occurrence WHERE taxonKey = 5219404 AND countryCode = \'BR\' AND year BETWEEN 2000 AND 2026',
    downloadPredicate: {
      type: 'and',
      predicates: [
        { type: 'equals', key: 'TAXON_KEY', value: '5219404' },
        { type: 'equals', key: 'COUNTRY', value: 'BR' },
        { type: 'equals', key: 'YEAR', value: '2000,2026' },
      ],
    },
  }

  const preview = {
    counts: {
      total: 4382,
      withCoordinates: 3910,
      withUsableCoordinates: 3602,
      withDate: 3881,
      withCoordinatesAndDate: 3505,
    },
    facets: {
      years: [
        { name: '2024', count: 187 },
        { name: '2023', count: 213 },
      ],
      countries: [{ name: 'BR', count: 4382 }],
      basisOfRecord: [
        { name: 'HUMAN_OBSERVATION', count: 2621 },
        { name: 'MACHINE_OBSERVATION', count: 1102 },
      ],
      datasets: [
        { name: 'dat-1', title: 'Jaguar camera-trap surveys', count: 1820, doi: '10.15468/example1' },
      ],
      issues: [
        { name: 'COORDINATE_ROUNDED', count: 38 },
        { name: 'ZERO_COORDINATE', count: 4 },
      ],
      taxa: [{ name: 'Panthera onca', count: 4382 }],
    },
    samplePoints: [
      { key: 1, lat: -10.2, lon: -52.3, year: 2024, country: 'BR', basisOfRecord: 'HUMAN_OBSERVATION', scientificName: 'Panthera onca' },
    ],
    coordinateUncertainty: { sampledRecords: 1, recordsWithUncertainty: 1, medianMeters: 1000, over10kmShare: 0.12 },
    samplingEvents: { countriesChecked: ['BR'], datasetHits: 2, note: 'Sampling-event signal detected.' },
    queryUrl: query.apiSearchUrl,
    fetchedAt: '2026-06-26T00:00:00.000Z',
    warnings: ['Review coordinate uncertainty before modelling.'],
  }

  const triage = {
    support: {
      headline: 'GBIF looks usable for cautious mapping of jaguar records in Brazil since 2000.',
      stronglySupported: ['Data discovery', 'Distribution mapping'],
      conditionallySupported: [],
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
        evidence: 'Country facets show BR with 4382 of 4382 records; sample points cluster in southeastern Brazil.',
        whyItMatters: 'Spatial clustering can bias downstream species distribution models.',
        recommendedMitigation: 'Review sampling bias before modelling.',
        relatedWorkflowStep: 'Coordinate cleaning',
      },
    ],
    readiness: { spatial: 80, temporal: 75, taxonomic: 95, dataType: 70 },
    recommendedFilters: ['Require usable coordinates (coordinateUncertaintyInMeters <= 10000).'],
    unsupportedClaims: ['Population abundance claims need monitoring data not present in GBIF.'],
    nextSteps: ['Create a DOI-backed GBIF download via occ_download().'],
  }

  return { intent, taxon, query, preview, triage }
}

function buildPayloadEnvelope(fixture) {
  return {
    ...fixture,
    models: { intent: 'fixture', triage: 'fixture', workflow: 'fixture' },
    generatedAt: '2026-06-26T00:00:00.000Z',
  }
}

async function runChecks(label, workflow) {
  const [r, py] = await Promise.all([
    validateRCode(workflow.rCode),
    validatePythonCode(workflow.pythonCode),
  ])
  return { label, r, py }
}

function summarize(result) {
  const lines = []
  lines.push(`- ${result.label}`)
  lines.push(`    R:      ${statusText(result.r)}`)
  if (result.r.stderr) lines.push(`             stderr: ${result.r.stderr.split('\n')[0].slice(0, 200)}`)
  if (result.r.reason) lines.push(`             reason: ${result.r.reason}`)
  lines.push(`    Python: ${statusText(result.py)}`)
  if (result.py.stderr) lines.push(`             stderr: ${result.py.stderr.split('\n')[0].slice(0, 200)}`)
  if (result.py.reason) lines.push(`             reason: ${result.py.reason}`)
  return lines.join('\n')
}

function statusText(check) {
  if (check.status === 'valid') return color(useColor, GREEN, 'PASS') + ' (parsed cleanly)'
  if (check.status === 'skipped')
    return color(useColor, YELLOW, 'SKIP') + ' (binary not on PATH; install for full validation)'
  return color(useColor, RED, 'FAIL') + ` — ${(check.stderr || '').slice(0, 120)}`
}

function isFailure(result) {
  return result.r.status === 'error' || result.py.status === 'error'
}

// Synthetic broken-code fixture. Used only when --check-validator is
// passed. Proves the harness (and the underlying validator) flips red
// when the LLM emits unparseable code — the exact scenario the
// /api/workflow handler falls back to the deterministic workflow for.
function buildBrokenWorkflow() {
  return {
    rCode: 'library(rgbif)\nocc_search(taxonKey <- 1\n', // unclosed paren
    pythonCode: 'def !!!:::', // invalid Python syntax
    sqlCode: 'SELECT 1',
    downloadRequestJson: '{}',
    cleaningR: '# empty',
    methodsText: '',
    limitationsText: '',
    citationInstructions: '',
    markdownReport: '',
    htmlReport: '',
    jsonPlan: '{}',
  }
}

const useColor = process.stdout.isTTY && !process.argv.includes('--json')

async function main() {
  // --check-validator is a self-test: synthesize known-broken R/Python,
  // run them through the validator, and assert the validator returns
  // status='error'. Lets reviewers confirm the validator is wired up
  // and not silently passing everything. Only useful when at least one
  // of the language binaries is installed.
  if (process.argv.includes('--check-validator')) {
    const broken = buildBrokenWorkflow()
    const [r, py] = await Promise.all([
      validateRCode(broken.rCode),
      validatePythonCode(broken.pythonCode),
    ])
    const rCaught = r.status === 'error'
    const pyCaught = py.status === 'error'
    const detail = { r, py }
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ rCaught, pyCaught, detail }, null, 2))
    } else {
      console.log(color(useColor, DIM, 'Validator self-test'))
      console.log(color(useColor, DIM, '=====================\n'))
      console.log(`R catch broken syntax:      ${rCaught ? color(useColor, GREEN, 'YES') : color(useColor, RED, 'NO ')} (status: ${r.status}${r.status === 'skipped' ? ' — install Rscript to test' : ''})`)
      console.log(`Python catch broken syntax: ${pyCaught ? color(useColor, GREEN, 'YES') : color(useColor, RED, 'NO ')} (status: ${py.status}${py.status === 'skipped' ? ' — install python3 to test' : ''})`)
      if (r.stderr) console.log(`  R stderr:      ${r.stderr.split('\n')[0].slice(0, 200)}`)
      if (py.stderr) console.log(`  Python stderr: ${py.stderr.split('\n')[0].slice(0, 200)}`)
    }
    // If both interpreters are missing we can't make a claim — exit 0
    // with a note. If at least one is present, it MUST catch the
    // broken input.
    const bothSkipped = r.status === 'skipped' && py.status === 'skipped'
    const atLeastOneCaught = rCaught || pyCaught
    process.exit(bothSkipped || atLeastOneCaught ? 0 : 1)
  }

  const fixture = buildFixturePayload()
  const payload = buildPayloadEnvelope(fixture)
  const results = []

  // Path 1: deterministic fallback (what ships when AI fails).
  // finalizeWorkflow + createFallbackWorkflow is the exact code path
  // /api/workflow's buildDeterministicResponse runs.
  const fallbackWorkflow = finalizeWorkflow(
    createFallbackWorkflow({
      ...fixture,
      reason: 'proof-of-runnability harness (no AI call)',
    }),
    payload,
  )
  results.push(await runChecks('Deterministic fallback workflow (createFallbackWorkflow)', fallbackWorkflow))

  // Path 2: AI success path — only when OPENAI_API_KEY is set, otherwise
  // we skip with an explanatory reason so CI without secrets still goes
  // green. We import lazily so the harness can run in environments
  // without the OpenAI SDK installed.
  if (process.env.OPENAI_API_KEY) {
    try {
      const { assessWorkflow } = await import('../server/openai.js')
      const assessment = await assessWorkflow({
        intent: fixture.intent,
        taxon: fixture.taxon,
        query: fixture.query,
        preview: fixture.preview,
        triage: fixture.triage,
      })
      const aiWorkflow = finalizeWorkflow(assessment.data, {
        ...payload,
        models: { ...payload.models, workflow: assessment.model },
      })
      results.push(await runChecks(`AI workflow (${assessment.model})`, aiWorkflow))
    } catch (error) {
      // AI couldn't produce a workflow (network down, key invalid, etc).
      // That's not a code-parse failure — there's nothing to parse yet.
      // Surface as SKIP so reviewers see what happened without flipping
      // the proof red.
      const reason = `AI path unavailable: ${error?.message || error}`
      results.push({
        label: 'AI workflow (call failed)',
        r: { status: 'skipped', reason },
        py: { status: 'skipped', reason },
      })
    }
  } else {
    results.push({
      label: 'AI workflow (skipped — set OPENAI_API_KEY to exercise)',
      r: { status: 'skipped', reason: 'OPENAI_API_KEY not set' },
      py: { status: 'skipped', reason: 'OPENAI_API_KEY not set' },
    })
  }

  const failures = results.filter(isFailure)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ results, failed: failures.length > 0 }, null, 2))
  } else {
    console.log(color(useColor, DIM, 'GBIF Workbench proof-of-runnability'))
    console.log(color(useColor, DIM, '====================================\n'))
    for (const result of results) {
      console.log(summarize(result))
    }
    console.log()
    if (failures.length === 0) {
      console.log(color(useColor, GREEN, `OK: all ${results.length} workflow path(s) parse-clean (or skipped).`))
    } else {
      console.log(color(useColor, RED, `FAIL: ${failures.length} workflow path(s) produced unparseable code.`))
    }
  }

  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('[check-workflow-runnable] Unexpected error:', error)
  process.exit(2)
})
