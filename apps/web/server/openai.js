import crypto from 'node:crypto'
import { createLruTtlCache } from './lib/lruTtlCache.js'
import { intentSchema, assessmentSchema } from './lib/openaiSchemas.js'
import { intentInstructions, assessmentInstructions } from './lib/openaiPrompts.js'

const OPENAI_API_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-5.4-mini'
const ASSESSMENT_CACHE_TTL_MS = 1000 * 60 * 10
const ASSESSMENT_CACHE_MAX_ENTRIES = Number(process.env.OPENAI_ASSESSMENT_CACHE_MAX_ENTRIES || 50)
const ASSESSMENT_CACHE_ENABLED = process.env.OPENAI_ASSESSMENT_CACHE !== 'false'

let fallbackModelPromise = null
const assessmentCache = createLruTtlCache({
  ttlMs: ASSESSMENT_CACHE_TTL_MS,
  maxEntries: ASSESSMENT_CACHE_MAX_ENTRIES,
})

export async function interpretStudyIntent({ question, overrides }) {
  const model = process.env.OPENAI_MODEL_INTENT || process.env.OPENAI_MODEL || DEFAULT_MODEL
  return createStructuredJson({
    model,
    schemaName: 'gbif_study_intent',
    schema: intentSchema,
    instructions: intentInstructions,
    effort: process.env.OPENAI_REASONING_EFFORT_INTENT || 'low',
    maxOutputTokens: 5000,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(
              {
                question,
                overrides: overrides || {},
                currentDate: new Date().toISOString().slice(0, 10),
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  })
}

export async function assessStudy({ intent, taxon, query, preview }) {
  const model = process.env.OPENAI_MODEL_ASSESSMENT || process.env.OPENAI_MODEL || DEFAULT_MODEL
  // Defaults are tuned for determinism:
  // - reasoning effort 'medium' gives the LLM enough thinking time to
  //   produce consistent qualitative judgments without burning extra
  //   tokens on speculative detail. 'low' produces more variance.
  // - We do NOT pass `temperature` because reasoning models (gpt-5.x,
  //   o-series) reject it; reasoning.effort is the supported lever.
  const effort = process.env.OPENAI_REASONING_EFFORT_ASSESSMENT || 'medium'
  const cacheKey = ASSESSMENT_CACHE_ENABLED ? buildAssessmentCacheKey({ model, effort, intent, taxon, query, preview }) : null
  if (cacheKey) {
    const cached = assessmentCache.get(cacheKey)
    if (cached) return cached
  }

  const result = await createStructuredJson({
    model,
    schemaName: 'gbif_study_assessment',
    schema: assessmentSchema,
    instructions: assessmentInstructions,
    effort,
    maxOutputTokens: 12000,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(
              {
                intent,
                gbifTaxonResolution: taxon,
                gbifQuery: query,
                gbifPreview: preview,
                constraints: [
                  'Use only the provided GBIF preview facts for record counts, country distribution, datasets, and temporal coverage.',
                  'Do not invent occurrence counts, datasets, citations, countries, DOI values, or statistical conclusions.',
                  'Classify whether GBIF-mediated occurrence data can support the proposed claim, and flag where additional effort, abundance, absence, environmental, or monitoring data are needed.',
                  'Generate reproducible R and Python workflow text that uses the provided GBIF query and download predicate, and reference the provided SQL/cube starter when discussing generated code links.',
                ],
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  })

  if (cacheKey) assessmentCache.set(cacheKey, result)
  return result
}

async function createStructuredJson({ model, schemaName, schema, instructions, input, effort, maxOutputTokens }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Add it to apps/web/.env before running GBIF Workbench.')
  }

  // We deliberately do NOT pass `temperature`. Reasoning models
  // (`o-series`, `gpt-5-series` family — including our default
  // `gpt-5.4-mini`) reject the `temperature` parameter with
  // "Unsupported parameter: 'temperature' is not supported with this
  // model." Determinism on reasoning models comes from
  // `reasoning.effort` (set to 'medium' for the assessment call),
  // not from temperature. The `temperature` arg is still in the
  // signature for backward-compat with non-reasoning models, but we
  // drop it on the wire.
  const payload = {
    model,
    instructions,
    input,
    reasoning: { effort },
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema,
      },
    },
    max_output_tokens: maxOutputTokens,
    store: false,
  }

  const response = await postOpenAI('/responses', payload, apiKey)
  if (response.ok) return parseStructuredResponse(await response.json(), model)

  const error = await readOpenAIError(response)
  if (isMissingModel(error)) {
    const fallbackModel = await resolveFallbackModel(apiKey)
    const fallbackResponse = await postOpenAI('/responses', { ...payload, model: fallbackModel }, apiKey)
    if (fallbackResponse.ok) return parseStructuredResponse(await fallbackResponse.json(), fallbackModel)
    throwOpenAIError(await readOpenAIError(fallbackResponse), fallbackResponse.status)
  }

  throwOpenAIError(error, response.status)
}

async function postOpenAI(path, payload, apiKey) {
  try {
    return await fetch(`${OPENAI_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown fetch error'
    throw new Error(`OpenAI network request failed: ${message}`)
  }
}

async function readOpenAIError(response) {
  try {
    return await response.json()
  } catch {
    return { error: { message: `${response.status} ${response.statusText}` } }
  }
}

function parseStructuredResponse(response, requestedModel) {
  const text = extractOutputText(response)
  if (!text) {
    throw new Error('OpenAI returned no structured output.')
  }

  try {
    return {
      data: JSON.parse(text),
      model: response.model || requestedModel,
      usage: response.usage || null,
    }
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON: ${error instanceof Error ? error.message : 'parse failed'}`)
  }
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text

  for (const item of response.output || []) {
    if (item.type !== 'message') continue
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
      if (content.type === 'text' && typeof content.text === 'string') return content.text
    }
  }

  return ''
}

async function resolveFallbackModel(apiKey) {
  if (!fallbackModelPromise) fallbackModelPromise = fetchBestAvailableModel(apiKey)
  return fallbackModelPromise
}

async function fetchBestAvailableModel(apiKey) {
  const response = await fetch(`${OPENAI_API_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) throwOpenAIError(await readOpenAIError(response), response.status)

  const models = await response.json()
  const candidates = (models.data || [])
    .map((item) => item.id)
    .filter(isReasoningCandidate)
    .sort((a, b) => scoreModel(b) - scoreModel(a))

  if (!candidates.length) {
    throw new Error('No compatible OpenAI GPT model is available to this API key.')
  }

  return candidates[0]
}

function isMissingModel(error) {
  const code = error?.error?.code || error?.error?.type || ''
  const message = String(error?.error?.message || '')
  return code === 'model_not_found' || /model.*not.*found|does not exist|do not have access/i.test(message)
}

function isReasoningCandidate(id) {
  return (
    /^gpt-\d/.test(id) &&
    !/(audio|realtime|tts|transcribe|image|embedding|moderation|search)/i.test(id)
  )
}

function scoreModel(id) {
  const version = id.match(/^gpt-(\d+(?:\.\d+)?)/)
  const versionScore = version ? Number(version[1]) * 1000 : 0
  const tierScore = id.includes('-pro') ? 90 : id.includes('-mini') ? 40 : id.includes('-nano') ? 20 : 70
  const snapshotPenalty = /\d{4}-\d{2}-\d{2}/.test(id) ? -1 : 0
  return versionScore + tierScore + snapshotPenalty
}

function throwOpenAIError(error, status) {
  const message = error?.error?.message || error?.message || `OpenAI request failed with status ${status}`
  throw new Error(`OpenAI request failed: ${message}`)
}

// LRU+TTL cache for assessStudy. The assessment prompt is grounded in the
// live GBIF preview, so the cache key folds in the inputs that actually
// change the answer: the model and reasoning effort, the resolved taxonKey,
// the query filter set, the analysis type, the preview counts/facets, and
// the preview's fetchedAt minute. Re-running the same scope within the TTL
// returns the prior structured output without calling OpenAI again.
function buildAssessmentCacheKey({ model, effort, intent, taxon, query, preview }) {
  if (!intent || !taxon || !query || !preview) return null
  const payload = {
    model,
    effort,
    taxonKey: taxon.taxonKey ?? null,
    analysisType: intent.analysisType || 'unknown',
    claimType: intent.claimType || '',
    preferredLanguage: intent.preferredLanguage || 'Both',
    apiParams: stableStringify(query.apiParams || {}),
    counts: preview.counts || {},
    yearFacets: topBucketCounts(preview.facets?.years, 50),
    countryFacets: topBucketCounts(preview.facets?.countries, 20),
    basisFacets: topBucketCounts(preview.facets?.basisOfRecord, 12),
    datasetFacets: topBucketCounts(preview.facets?.datasets, 10),
    issueFacets: topBucketCounts(preview.facets?.issues, 12),
    samplingEventHits: preview.samplingEvents?.datasetHits ?? 0,
    sampledPoints: Array.isArray(preview.samplePoints) ? preview.samplePoints.length : 0,
    fetchedAtMinute: (preview.fetchedAt || '').slice(0, 16),
  }
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex')
}

function topBucketCounts(facets, limit) {
  if (!Array.isArray(facets)) return []
  return facets
    .slice(0, limit)
    .map((bucket) => ({ name: String(bucket.name ?? ''), count: Number(bucket.count ?? 0) }))
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}