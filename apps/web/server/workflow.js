// Pure helpers shared between the Vercel serverless handlers in
// `apps/web/api/*.js` and the local Express dev shell in
// `apps/web/server/index.js`. This module has no Express or `node:` imports
// so it is safe to load in any Node.js runtime (Vercel serverless, local
// dev, tests).

export function createHealthResponse() {
  return {
    ok: true,
    service: 'gbif-workbench',
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    intentModel:
      process.env.OPENAI_MODEL_INTENT || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    assessmentModel:
      process.env.OPENAI_MODEL_ASSESSMENT ||
      process.env.OPENAI_MODEL ||
      'gpt-5.4-mini',
  }
}

function validateRequestBody(body) {
  const question = String(body?.question || '').trim()
  if (!question) {
    return { ok: false, error: 'A research question is required.' }
  }
  if (question.length > 2000) {
    return {
      ok: false,
      error: `Research questions must be 2000 characters or fewer. Yours is ${question.length}.`,
    }
  }
  if (detectPromptInjection(question)) {
    return {
      ok: false,
      error:
        'This question looks like an attempt to override GBIF Workbench instructions. ' +
        'Please rephrase as a plain biodiversity research question.',
    }
  }
  const overrides =
    body?.overrides && typeof body.overrides === 'object' ? body.overrides : {}
  return { ok: true, value: { question, overrides } }
}

// Mirror of the client-side prompt-injection guard in
// `apps/web/src/lib/queryGuard.ts`. Kept as a small standalone regex
// list here so the server can reject obvious attacks without making a
// network round-trip to OpenAI. Keep the two in sync when adding new
// patterns.
function detectPromptInjection(question) {
  const patterns = [
    /\b(ignore|disregard|forget|skip|override|bypass)\b[\s\S]{0,40}\b(previous|prior|above|earlier|system|original|all|the)\b[\s\S]{0,40}\b(instruction|prompt|directive|rule|context|message|guideline)/i,
    /(^|\n)\s*(system|assistant|user)\s*:\s*[^\n]{20,}/i,
    /\b(you are now|act as|pretend to be|roleplay as|behave as|be a|become a)\b[\s\S]{0,80}\b(developer|admin|root|jailbreak|DAN|unrestricted|uncensored|evil|hacker|model|chatbot|ai|assistant)\b/i,
    /\b(reveal|show|print|output|repeat|tell me|share|dump|leak|expose)\b[\s\S]{0,40}\b(your|the|my)\b[\s\S]{0,40}\b(system|hidden|secret|internal|original|full)\b[\s\S]{0,40}\b(prompt|instruction|message|context|rules?)\b/i,
    /<\s*\|?\s*(system|assistant|im_start|instruction|prompt)\s*\|?\s*>/i,
    /\b(jailbreak|DAN mode|developer mode|god mode|sudo)\b/i,
  ]
  return patterns.some((pattern) => pattern.test(question))
}

export const validateParseIntentBody = validateRequestBody
export const validateStudyPlanBody = validateRequestBody

export function seedIntentFromOverrides(overrides) {
  // Build a minimal intent shape that resolveTaxon() can consume before the
  // LLM returns. Only taxon-related overrides matter here; everything else is
  // filled with safe defaults. If the user did not provide a taxon, the seed
  // produces the same NO_TAXON_QUERY result as resolveTaxon would produce
  // against an empty intent.
  const taxonText =
    typeof overrides?.taxonText === 'string' ? overrides.taxonText.trim() : ''
  const taxonQuery =
    typeof overrides?.taxonQuery === 'string'
      ? overrides.taxonQuery.trim()
      : taxonText
  const taxonomicRank =
    typeof overrides?.taxonomicRank === 'string'
      ? overrides.taxonomicRank.trim()
      : ''
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

function normalizeSupportHeadline(value) {
  const headline = String(value || '').trim()
  return headline
    .replace(/^(yes|no)\s*[—–-]\s*/i, '')
    .replace(/^(yes|no),?\s+/i, '')
}

function normalizeReadiness(value) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  if (score > 0 && score <= 5) return Math.round(score * 20)
  if (score > 5 && score <= 10) return Math.round(score * 10)
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function finalizeWorkflow(workflow, payload) {
  return {
    ...workflow,
    sqlCode: payload.query.sqlCubeQuery,
    downloadRequestJson: createDownloadRequestJson(payload.query.downloadPredicate),
    jsonPlan: JSON.stringify(payload, null, 2),
  }
}

export function normalizeTriage(triage) {
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