import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assessStudy, interpretStudyIntent } from './openai.js'
import { buildGbifQuery, normalizeIntent, previewGbifData, resolveTaxon } from './gbif.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const port = Number(process.env.PORT || 8787)

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'gbif-workbench',
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    intentModel: process.env.OPENAI_MODEL_INTENT || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    assessmentModel: process.env.OPENAI_MODEL_ASSESSMENT || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  })
})

app.post('/api/parse-intent', async (request, response) => {
  const question = String(request.body?.question || '').trim()
  const overrides = request.body?.overrides && typeof request.body.overrides === 'object' ? request.body.overrides : {}

  if (!question) {
    response.status(400).json({ error: 'A research question is required.' })
    return
  }

  try {
    const interpreted = await interpretStudyIntent({ question, overrides })
    response.json({
      intent: normalizeIntent(interpreted.data),
      model: interpreted.model,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GBIF Workbench interpretation failed.'
    console.error('[parse-intent]', message)
    response.status(500).json({ error: message })
  }
})

app.post('/api/study-plan', async (request, response) => {
  const question = String(request.body?.question || '').trim()
  const overrides = request.body?.overrides && typeof request.body.overrides === 'object' ? request.body.overrides : {}

  if (!question) {
    response.status(400).json({ error: 'A research question is required.' })
    return
  }

  try {
    // Start the LLM intent interpretation in parallel with a seed GBIF taxon
    // resolution that uses the user's draft overrides (taxon text + rank only).
    // If the LLM later rewrites the taxon, we re-resolve against the GBIF
    // Backbone. This overlaps the slowest single call (LLM) with a fast GBIF
    // round trip when the user has typed a concrete taxon name.
    const [interpreted, seedTaxon] = await Promise.all([
      interpretStudyIntent({ question, overrides }),
      resolveTaxon(seedIntentFromOverrides(overrides)),
    ])
    const intent = normalizeIntent(interpreted.data)
    const seedName = String(seedTaxon.sourceName || '').trim().toLowerCase()
    const llmName = String(intent.taxonQuery || intent.taxonText || '').trim().toLowerCase()
    // If the LLM produced a taxon name that differs from the seed (including
    // the empty-seed case where the user did not fill the draft taxon field),
    // re-resolve against the GBIF Backbone so downstream steps use the
    // LLM-chosen canonical name.
    const taxon = llmName && seedName !== llmName ? await resolveTaxon(intent) : seedTaxon
    const query = buildGbifQuery(intent, taxon)
    const preview = await previewGbifData(intent, query)
    const assessment = await assessStudy({ intent, taxon, query, preview })
    const triage = normalizeTriage(assessment.data.triage)
    const workflow = finalizeWorkflow(assessment.data.workflow, {
      intent,
      taxon,
      query,
      preview,
      triage,
      models: {
        intent: interpreted.model,
        assessment: assessment.model,
      },
      generatedAt: new Date().toISOString(),
    })

    response.json({
      intent,
      taxon,
      query,
      preview,
      triage,
      workflow,
      models: {
        intent: interpreted.model,
        assessment: assessment.model,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GBIF Workbench analysis failed.'
    console.error('[study-plan]', message)
    response.status(500).json({ error: message })
  }
})

const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, '127.0.0.1', () => {
  console.log(`GBIF Workbench API listening on http://127.0.0.1:${port}`)
})

function finalizeWorkflow(workflow, payload) {
  return {
    ...workflow,
    sqlCode: payload.query.sqlCubeQuery,
    downloadRequestJson: createDownloadRequestJson(payload.query.downloadPredicate),
    jsonPlan: JSON.stringify(payload, null, 2),
  }
}

function createDownloadRequestJson(predicate) {
  return JSON.stringify(
    {
      notificationAddresses: ['userEmail@example.org'],
      sendNotification: true,
      format: 'SIMPLE_CSV',
      predicate,
    },
    null,
    2,
  )
}

function normalizeTriage(triage) {
  return {
    ...triage,
    support: {
      ...triage.support,
      headline: normalizeSupportHeadline(triage.support?.headline),
    },
    readiness: {
      spatial: normalizeReadiness(triage.readiness?.spatial),
      temporal: normalizeReadiness(triage.readiness?.temporal),
      taxonomic: normalizeReadiness(triage.readiness?.taxonomic),
      dataType: normalizeReadiness(triage.readiness?.dataType),
    },
  }
}

function normalizeSupportHeadline(value) {
  const headline = String(value || '').trim()
  return headline.replace(/^(yes|no)\s*[—–-]\s*/i, '').replace(/^(yes|no),?\s+/i, '')
}

function normalizeReadiness(value) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  if (score > 0 && score <= 5) return Math.round(score * 20)
  if (score > 5 && score <= 10) return Math.round(score * 10)
  return Math.max(0, Math.min(100, Math.round(score)))
}

function seedIntentFromOverrides(overrides) {
  // Build a minimal intent shape that resolveTaxon() can consume before the
  // LLM returns. Only taxon-related overrides matter here; everything else is
  // filled with safe defaults. If the user did not provide a taxon, the seed
  // produces the same NO_TAXON_QUERY result as resolveTaxon would produce
  // against an empty intent.
  const taxonText = typeof overrides?.taxonText === 'string' ? overrides.taxonText.trim() : ''
  const taxonQuery = typeof overrides?.taxonQuery === 'string' ? overrides.taxonQuery.trim() : taxonText
  const taxonomicRank = typeof overrides?.taxonomicRank === 'string' ? overrides.taxonomicRank.trim() : ''
  return {
    question: '',
    taxonText,
    taxonQuery,
    taxonomicRank,
    regionText: '',
    countries: [],
    startYear: null,
    endYear: null,
    analysisType: 'unknown',
    claimType: '',
    requiredData: [],
    possibleRequiredExtraData: [],
    spatialResolution: '',
    skillLevel: '',
    preferredLanguage: 'Both',
    confidence: 0,
    ambiguities: [],
  }
}
