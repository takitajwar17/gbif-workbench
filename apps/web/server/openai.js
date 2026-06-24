const OPENAI_API_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-5.4-mini'

let fallbackModelPromise = null

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
  return createStructuredJson({
    model,
    schemaName: 'gbif_study_assessment',
    schema: assessmentSchema,
    instructions: assessmentInstructions,
    effort: process.env.OPENAI_REASONING_EFFORT_ASSESSMENT || 'low',
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
}

async function createStructuredJson({ model, schemaName, schema, instructions, input, effort, maxOutputTokens }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Add it to apps/web/.env before running StudyScout.')
  }

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

const analysisTypes = [
  'distribution_mapping',
  'species_distribution_modelling',
  'range_shift_exploration',
  'temporal_trend_or_abundance',
  'invasive_monitoring_preview',
  'unknown',
]

const preferredLanguages = ['R', 'Python', 'Both']
const riskLevels = ['LOW', 'MODERATE', 'HIGH', 'BLOCKING', 'UNKNOWN']
const riskCategories = ['spatial', 'temporal', 'taxonomic', 'source', 'data_type', 'citation', 'other']

const intentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'question',
    'taxonText',
    'taxonQuery',
    'taxonomicRank',
    'regionText',
    'countries',
    'startYear',
    'endYear',
    'analysisType',
    'claimType',
    'requiredData',
    'possibleRequiredExtraData',
    'spatialResolution',
    'skillLevel',
    'preferredLanguage',
    'confidence',
    'ambiguities',
  ],
  properties: {
    question: { type: 'string' },
    taxonText: { type: 'string' },
    taxonQuery: { type: 'string' },
    taxonomicRank: { type: 'string' },
    regionText: { type: 'string' },
    countries: { type: 'array', items: { type: 'string' } },
    startYear: { type: ['integer', 'null'] },
    endYear: { type: ['integer', 'null'] },
    analysisType: { type: 'string', enum: analysisTypes },
    claimType: { type: 'string' },
    requiredData: { type: 'array', items: { type: 'string' } },
    possibleRequiredExtraData: { type: 'array', items: { type: 'string' } },
    spatialResolution: { type: 'string' },
    skillLevel: { type: 'string' },
    preferredLanguage: { type: 'string', enum: preferredLanguages },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    ambiguities: { type: 'array', items: { type: 'string' } },
  },
}

const riskSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'category',
    'level',
    'title',
    'explanation',
    'evidence',
    'whyItMatters',
    'recommendedMitigation',
    'relatedWorkflowStep',
  ],
  properties: {
    category: { type: 'string', enum: riskCategories },
    level: { type: 'string', enum: riskLevels },
    title: { type: 'string' },
    explanation: { type: 'string' },
    evidence: { type: 'string' },
    whyItMatters: { type: 'string' },
    recommendedMitigation: { type: 'string' },
    relatedWorkflowStep: { type: ['string', 'null'] },
  },
}

const assessmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['triage', 'workflow'],
  properties: {
    triage: {
      type: 'object',
      additionalProperties: false,
      required: ['support', 'risks', 'readiness', 'recommendedFilters', 'unsupportedClaims', 'nextSteps'],
      properties: {
        support: {
          type: 'object',
          additionalProperties: false,
          required: [
            'headline',
            'stronglySupported',
            'conditionallySupported',
            'exploratoryOnly',
            'notSupportedWithOccurrenceOnly',
            'insufficientData',
          ],
          properties: {
            headline: { type: 'string' },
            stronglySupported: { type: 'array', items: { type: 'string' } },
            conditionallySupported: { type: 'array', items: { type: 'string' } },
            exploratoryOnly: { type: 'array', items: { type: 'string' } },
            notSupportedWithOccurrenceOnly: { type: 'array', items: { type: 'string' } },
            insufficientData: { type: 'array', items: { type: 'string' } },
          },
        },
        risks: { type: 'array', minItems: 3, items: riskSchema },
        readiness: {
          type: 'object',
          additionalProperties: false,
          required: ['spatial', 'temporal', 'taxonomic', 'dataType'],
          properties: {
            spatial: { type: 'integer', minimum: 0, maximum: 100 },
            temporal: { type: 'integer', minimum: 0, maximum: 100 },
            taxonomic: { type: 'integer', minimum: 0, maximum: 100 },
            dataType: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
        recommendedFilters: { type: 'array', items: { type: 'string' } },
        unsupportedClaims: { type: 'array', items: { type: 'string' } },
        nextSteps: { type: 'array', items: { type: 'string' } },
      },
    },
    workflow: {
      type: 'object',
      additionalProperties: false,
      required: [
        'rCode',
        'pythonCode',
        'cleaningR',
        'methodsText',
        'limitationsText',
        'citationInstructions',
        'markdownReport',
        'htmlReport',
      ],
      properties: {
        rCode: { type: 'string' },
        pythonCode: { type: 'string' },
        cleaningR: { type: 'string' },
        methodsText: { type: 'string' },
        limitationsText: { type: 'string' },
        citationInstructions: { type: 'string' },
        markdownReport: { type: 'string' },
        htmlReport: { type: 'string' },
      },
    },
  },
}

const intentInstructions = `
You turn a biodiversity research question into a precise GBIF study scope.

Return only JSON that matches the schema. Use the user's overrides as authoritative when present, but normalize them into useful GBIF terms.

Rules:
- Choose taxonQuery as the best scientific name, canonical taxon name, or higher taxon name to send to the GBIF Backbone. Do not use a casual common name if a better scientific query is clear.
- taxonText is the human-readable taxon phrase the user expects to see.
- taxonomicRank should be a GBIF-style rank when inferable, such as SPECIES, GENUS, FAMILY, ORDER, CLASS, PHYLUM, or UNKNOWN.
- Resolve regions to ISO 3166-1 alpha-2 country codes only when there is a defensible country-level interpretation. If the region is broad or ambiguous, include the best standard country list and explain ambiguity.
- If a country boundary or region definition is uncertain, put that uncertainty in ambiguities instead of hiding it.
- Infer analysisType from the research question. Use temporal_trend_or_abundance only when the user asks about decline, population trend, abundance, monitoring, or change in amount.
- Use null for missing years. If only one year is clearly provided and the wording implies "since", use it as startYear and leave endYear null.
- requiredData and possibleRequiredExtraData must name scientific data types, not UI features.
- preferredLanguage should preserve an override if present; otherwise return Both.
- confidence is your confidence in the interpretation, not in GBIF data suitability.
`

const assessmentInstructions = `
You are GBIF StudyScout, a cautious biodiversity-data research planning assistant.

Return only JSON that matches the schema. Ground every record-count, country, dataset, and temporal-coverage statement in the provided GBIF preview. Do not invent data.

Scientific stance:
- Separate data availability from data suitability and claim strength.
- Never say that GBIF data proves a population decline, abundance trend, climate effect, causal effect, or conservation status by itself.
- Ordinary occurrence records can support mapping, exploratory occurrence summaries, first-pass spatial bias checks, and candidate workflows.
- Species distribution modelling, range-shift work, and temporal trend work require explicit caveats about sampling bias, effort, coordinate quality, temporal coverage, and environmental or survey covariates.
- If the claim needs abundance, absence, effort, standardized repeated sampling, or survey protocol data, flag that as not supported by occurrence-only data unless the preview shows relevant sampling-event discovery only as a discovery signal.
- support.headline must use nuanced language such as "Good starting point", "Usable with caveats", "Exploratory only", "Needs different data type", or "Not enough data". Do not start the headline with "Yes" or "No".
- readiness scores must be integers from 0 to 100.

Workflow requirements:
- Use the provided gbifQuery URLs and downloadPredicate in generated R and Python code.
- Mention that the export package includes a predicate download request JSON with placeholder GBIF account notification details.
- Reference the provided gbifQuery.sqlCubeQuery as the SQL/cube starter query when describing generated code links.
- Include DOI-backed GBIF occurrence download guidance and datasetKey preservation.
- R code should use rgbif, dplyr, and readr; include occ_download() for serious reuse; include optional CoordinateCleaner guidance and authenticated download guidance without real credentials.
- Python code should use pygbif or requests plus pandas for preview/download request construction without real credentials.
- cleaningR should include coordinate/date checks, duplicate handling, issue summaries, coordinate uncertainty handling, and placeholders for taxon-specific review.
- methodsText, limitationsText, citationInstructions, markdownReport, and htmlReport must be ready to export.
- markdownReport must include these sections: Title, User research question, Interpreted study scope, Taxon resolution, Region resolution, Data needed for intended claim, GBIF data availability preview, Data-type triage, Bias and limitation assessment, Supported and unsupported claims, Recommended filters, Recommended workflow, Generated code links, Citation instructions, Limitations and assumptions, What to do next.
- Do not include fake sample records or demo results.
`
