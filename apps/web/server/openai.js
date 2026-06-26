import './env.js'
import crypto from 'node:crypto'
import { createLruTtlCache } from './lib/lruTtlCache.js'
import { shouldRetry, retryDelayMs, escalationBudget } from './lib/retryPolicy.js'
import {
  intentSchema,
  triageSchema,
  workflowSchema,
} from './lib/openaiSchemas.js'
import {
  intentInstructions,
  triageInstructions,
  workflowInstructions,
} from './lib/openaiPrompts.js'

const OPENAI_API_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-5.4-mini'
const ASSESSMENT_CACHE_TTL_MS = 1000 * 60 * 10
const ASSESSMENT_CACHE_MAX_ENTRIES = Number(process.env.OPENAI_ASSESSMENT_CACHE_MAX_ENTRIES || 50)
const ASSESSMENT_CACHE_ENABLED = process.env.OPENAI_ASSESSMENT_CACHE !== 'false'

// Per-attempt timeout + retry count, separately configured for the
// intent, triage, and workflow calls so each fits the Vercel Hobby 60s
// ceiling on cold path even with retries/fallbacks.
//
//   /api/study-plan (intent): keep two attempts because a valid intent
//     is required to query GBIF correctly.
//
//   /api/study-plan (triage): one fast attempt. If it times out or the
//     AI service is transiently unavailable, the route returns a
//     deterministic preview-based triage instead of failing the whole
//     analysis.
//
//   /api/workflow (workflow): one bounded attempt by default. If the
//     large workflow call misses the timeout, /api/workflow returns a
//     deterministic export package so export controls still work.
//
// Override via env:
//   OPENAI_INTENT_ATTEMPT_TIMEOUT_MS, OPENAI_INTENT_MAX_ATTEMPTS
//   OPENAI_TRIAGE_ATTEMPT_TIMEOUT_MS, OPENAI_TRIAGE_MAX_ATTEMPTS
//   OPENAI_WORKFLOW_ATTEMPT_TIMEOUT_MS, OPENAI_WORKFLOW_MAX_ATTEMPTS
//   OPENAI_RETRY_BACKOFF_MS
const DEFAULT_INTENT_ATTEMPT_TIMEOUT_MS = Number(process.env.OPENAI_INTENT_ATTEMPT_TIMEOUT_MS || 20_000)
const DEFAULT_INTENT_MAX_ATTEMPTS = Number(process.env.OPENAI_INTENT_MAX_ATTEMPTS || 2)
const DEFAULT_TRIAGE_ATTEMPT_TIMEOUT_MS = Number(process.env.OPENAI_TRIAGE_ATTEMPT_TIMEOUT_MS || 12_000)
const DEFAULT_TRIAGE_MAX_ATTEMPTS = Number(process.env.OPENAI_TRIAGE_MAX_ATTEMPTS || 1)
const DEFAULT_WORKFLOW_ATTEMPT_TIMEOUT_MS = Number(process.env.OPENAI_WORKFLOW_ATTEMPT_TIMEOUT_MS || 15_000)
const DEFAULT_WORKFLOW_MAX_ATTEMPTS = Number(process.env.OPENAI_WORKFLOW_MAX_ATTEMPTS || 1)
const DEFAULT_RETRY_BACKOFF_MS = Number(process.env.OPENAI_RETRY_BACKOFF_MS || 1_000)

let fallbackModelPromise = null
const triageCache = createLruTtlCache({
  ttlMs: ASSESSMENT_CACHE_TTL_MS,
  maxEntries: ASSESSMENT_CACHE_MAX_ENTRIES,
})
const workflowCache = createLruTtlCache({
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
    // The intent call is required to query GBIF correctly, so keep a
    // real retry budget even though triage itself now degrades to a
    // deterministic fallback.
    maxAttempts: DEFAULT_INTENT_MAX_ATTEMPTS,
    attemptTimeoutMs: DEFAULT_INTENT_ATTEMPT_TIMEOUT_MS,
    retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
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

// Triage assessment: returns the qualitative "What GBIF Workbench found"
// card. This is the small, fast call that the first endpoint emits so
// the user sees readiness + risks + headline immediately.
export async function assessTriage({ intent, taxon, query, preview }) {
  const model = process.env.OPENAI_MODEL_ASSESSMENT || process.env.OPENAI_MODEL || DEFAULT_MODEL
  // Defaults are tuned for determinism:
  // - reasoning effort is user-configurable; the default is 'low' to
  //   keep cold-path latency short and stay well under the Vercel
  //   Hobby 60s ceiling for both /api/study-plan and /api/workflow.
  //   Override with OPENAI_REASONING_EFFORT_ASSESSMENT (e.g. 'medium'
  //   or 'high') for higher-quality qualitative judgments at the cost
  //   of longer latency.
  // - We do NOT pass `temperature` because reasoning models (gpt-5.x,
  //   o-series) reject it; reasoning.effort is the supported lever.
  const effort = process.env.OPENAI_REASONING_EFFORT_ASSESSMENT || 'low'
  const cacheKey = ASSESSMENT_CACHE_ENABLED
    ? buildAssessmentCacheKey({ scope: 'triage', model, effort, intent, taxon, query, preview })
    : null
  if (cacheKey) {
    const cached = triageCache.get(cacheKey)
    if (cached) return cached
  }

  const result = await createStructuredJson({
    model,
    schemaName: 'gbif_study_triage',
    schema: triageSchema,
    instructions: triageInstructions,
    effort,
    maxOutputTokens: 4500,
    // Triage: one fast attempt by default. If this misses the timeout,
    // /api/study-plan falls back to deterministic, preview-grounded
    // triage instead of failing the whole study.
    maxAttempts: DEFAULT_TRIAGE_MAX_ATTEMPTS,
    attemptTimeoutMs: DEFAULT_TRIAGE_ATTEMPT_TIMEOUT_MS,
    retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
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
                  'Set readiness.spatial / temporal / taxonomic / dataType to 0 — the Workbench computes them deterministically from the preview.',
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

  if (cacheKey) triageCache.set(cacheKey, result)
  return result
}

// Workflow generation: returns the long-form reproducible code, methods
// text, and reports. This is the heavy call that lives behind
// /api/workflow so the user sees the result card immediately while the
// workflow streams in.
export async function assessWorkflow({ intent, taxon, query, preview, triage }) {
  const model = process.env.OPENAI_MODEL_ASSESSMENT || process.env.OPENAI_MODEL || DEFAULT_MODEL
  // Same env-driven effort as assessTriage. Default is 'low' to keep
  // /api/workflow under the Vercel Hobby 60s ceiling on cold path.
  // Bump to 'medium' / 'high' via OPENAI_REASONING_EFFORT_ASSESSMENT
  // for higher-quality code + markdown at the cost of longer latency.
  const effort = process.env.OPENAI_REASONING_EFFORT_ASSESSMENT || 'low'
  const cacheKey = ASSESSMENT_CACHE_ENABLED
    ? buildAssessmentCacheKey({ scope: 'workflow', model, effort, intent, taxon, query, preview, triage })
    : null
  if (cacheKey) {
    const cached = workflowCache.get(cacheKey)
    if (cached) return cached
  }

  const result = await createStructuredJson({
    model,
    schemaName: 'gbif_study_workflow',
    schema: workflowSchema,
    instructions: workflowInstructions,
    effort,
    // The workflow schema produces the heaviest output: 8 long text
    // fields, often several thousand tokens. We allow a generous output
    // budget here so the LLM can finish every field (R code, Python
    // code, markdown report, html report) without truncation.
    maxOutputTokens: 12000,
    // Workflow: one bounded attempt by default. If it misses, the API
    // returns deterministic exports rather than blocking all export
    // controls behind a large AI response.
    maxAttempts: DEFAULT_WORKFLOW_MAX_ATTEMPTS,
    attemptTimeoutMs: DEFAULT_WORKFLOW_ATTEMPT_TIMEOUT_MS,
    retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
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
                gbifTriage: triage || null,
                constraints: [
                  'Use the provided GBIF query URLs and downloadPredicate in generated R and Python code.',
                  'Reference the provided gbifQuery.sqlCubeQuery as the SQL/cube starter query when describing generated code links.',
                  'R code should use rgbif, dplyr, and readr; include occ_download() for serious reuse; include optional CoordinateCleaner guidance and authenticated download guidance without real credentials.',
                  'Python code should use pygbif or requests plus pandas for preview/download request construction without real credentials.',
                  'cleaningR should include coordinate/date checks, duplicate handling, issue summaries, coordinate uncertainty handling, and placeholders for taxon-specific review.',
                  'markdownReport must include: Title, User research question, Interpreted study scope, Taxon resolution, Region resolution, Data needed for intended claim, GBIF data availability preview, Data-type triage, Bias and limitation assessment, Supported and unsupported claims, Recommended filters, Recommended workflow, Generated code links, Citation instructions, Limitations and assumptions, What to do next.',
                  'Do not include fake sample records or demo results.',
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

  if (cacheKey) workflowCache.set(cacheKey, result)
  return result
}

async function createStructuredJson({
  model,
  schemaName,
  schema,
  instructions,
  input,
  effort,
  maxOutputTokens,
  maxAttempts,
  attemptTimeoutMs,
  retryBackoffMs,
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Add it to apps/web/.env before running GBIF Workbench.')
  }

  // We deliberately do NOT pass `temperature`. Reasoning models
  // (`o-series`, `gpt-5-series` family — including our default
  // `gpt-5.4-mini`) reject the `temperature` parameter with
  // "Unsupported parameter: 'temperature' is not supported with this
  // model." Determinism on reasoning models comes from
  // `reasoning.effort`, not from temperature. The `temperature` arg is
  // dropped on the wire.
  function buildPayload(tokenBudget) {
    return {
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
      max_output_tokens: tokenBudget,
      store: false,
    }
  }

  // Retry loop. Runs up to `maxAttempts` total attempts. Between
  // attempts sleeps for `retryDelayMs` (exponential backoff from
  // `retryBackoffMs`). The token budget escalates across attempts so
  // the most common failure mode (truncated JSON because thinking ate
  // the budget) clears itself on retry with more room.
  let lastError
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    const tokenBudget = escalationBudget(maxOutputTokens, attemptNumber)
    try {
      return await postStructuredJsonAttempt({
        payload: buildPayload(tokenBudget),
        apiKey,
        model,
        attemptTimeoutMs,
        tokenBudget,
        attemptNumber,
      })
    } catch (error) {
      lastError = error
      // Log retries so dev can see the recovery in action. We log at
      // warn level (not error) because retries are expected — the
      // first attempt failing isn't a bug, it's why we have retries.
      if (attemptNumber < maxAttempts) {
        const delay = retryDelayMs({ attemptNumber, baseMs: retryBackoffMs })
        console.warn(
          `[openai] attempt ${attemptNumber}/${maxAttempts} failed (${error?.message || 'unknown'}); retrying in ${delay}ms with max_output_tokens=${tokenBudget}`,
        )
      }
      if (!shouldRetry(error, { attemptNumber, maxAttempts })) {
        throw error
      }
      if (attemptNumber < maxAttempts) {
        await sleep(retryDelayMs({ attemptNumber, baseMs: retryBackoffMs }))
      }
    }
  }
  // All attempts exhausted; surface the last error.
  throw lastError
}

// Runs ONE attempt against OpenAI: POSTs the payload, parses the
// response, handles the model-not-found fallback. Throws on any
// failure so the caller's retry loop can decide whether to retry.
async function postStructuredJsonAttempt({
  payload,
  apiKey,
  model,
  attemptTimeoutMs,
  tokenBudget,
  attemptNumber,
}) {
  // Per-attempt server-side timeout via AbortController. Each
  // attempt is independent — if one times out, the next starts
  // fresh. The retry loop above decides whether the timeout is
  // retryable.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), attemptTimeoutMs)
  let response
  try {
    response = await postOpenAI('/responses', payload, apiKey, controller.signal)
  } finally {
    clearTimeout(timer)
  }

  if (response.ok) {
    return parseStructuredResponse(await response.json(), model)
  }

  const error = await readOpenAIError(response)

  // Model-not-found fallback: try one alternative model from the
  // /v1/models list. This is its own non-retryable path — once the
  // fallback model works, we return immediately. The fallback
  // itself isn't retried because the failure mode (model doesn't
  // exist) won't change on retry.
  if (isMissingModel(error)) {
    const fallbackModel = await resolveFallbackModel(apiKey)
    const fallbackController = new AbortController()
    const fallbackTimer = setTimeout(() => fallbackController.abort(), attemptTimeoutMs)
    let fallbackResponse
    try {
      fallbackResponse = await postOpenAI(
        '/responses',
        { ...payload, model: fallbackModel },
        apiKey,
        fallbackController.signal,
      )
    } finally {
      clearTimeout(fallbackTimer)
    }
    if (fallbackResponse.ok) {
      return parseStructuredResponse(await fallbackResponse.json(), fallbackModel)
    }
    throwOpenAIError(await readOpenAIError(fallbackResponse), fallbackResponse.status)
  }

  // Surface as a tagged error so shouldRetry can pattern-match the
  // status. We include the attempt number + token budget + status
  // code in the message so shouldRetry can find the "status 5xx" /
  // "status 429" patterns in the message string.
  const status = response.status
  const reason = error?.error?.message || error?.message || `${status} ${response.statusText}`
  const err = new Error(
    `OpenAI request failed with status ${status} (attempt ${attemptNumber}, max_output_tokens=${tokenBudget}): ${reason}`,
  )
  err.status = status
  throw err
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postOpenAI(path, payload, apiKey, signal) {
  try {
    return await fetch(`${OPENAI_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('OpenAI request timed out before it could complete.')
    }
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

// LRU+TTL caches for the two assessment calls. The assessment prompt
// is grounded in the live GBIF preview, so the cache key folds in the
// inputs that actually change the answer: the model and reasoning
// effort, the resolved taxonKey, the query filter set, the analysis
// type, the preview counts/facets, and the preview's fetchedAt minute.
// Workflow cache keys also include a digest of the triage object because
// the workflow prompt uses that verdict as source material for reports.
// Re-running the same scope within the TTL returns the prior
// structured output without calling OpenAI again.
//
// The triage and workflow caches are split so a cache hit on one
// (e.g. the user re-runs the same question) doesn't pull a stale entry
// from the other after we've tuned the prompts. The `scope` segment
// is included in the hash so a key collision between the two is
// impossible.
function buildAssessmentCacheKey({ scope, model, effort, intent, taxon, query, preview, triage = null }) {
  if (!intent || !taxon || !query || !preview) return null
  const payload = {
    scope,
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
    triageDigest: scope === 'workflow' ? stableDigest(triage ?? null) : null,
  }
  return stableDigest(payload)
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

function stableDigest(value) {
  return crypto.createHash('sha256').update(stableStringify(value) ?? 'undefined').digest('hex')
}
