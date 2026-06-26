// JSON-Schema definitions for the three OpenAI structured-output calls
// (study-intent interpretation, triage assessment, and workflow generation).
// Kept separate from `openai.js` so the orchestration file focuses on
// request/response flow rather than schema verbosity.
//
// The assessment used to be a single call that produced BOTH triage and
// workflow. That call took 15-30s on cold path and pushed the Vercel
// Hobby 60s ceiling. Splitting into two calls gives each its own budget.

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

export const intentSchema = {
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

// Triage schema: what fits on the result card. Compact, fast.
// Readiness block is in the schema (we overwrite it deterministically in
// `normalizeTriage`) so the structured-output call doesn't fail when the
// LLM emits a number for those fields. The LLM is told to set them to 0.
export const triageSchema = {
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
}

// Workflow schema: the long-form reproducible code, methods text, and
// reports. Lives in its own endpoint because this content dominates
// the assessment's token output and is the part that historically
// pushed the cold-path call over the Vercel Hobby 60s ceiling.
export const workflowSchema = {
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
}

// Backwards-compatible alias used by callers/tests that still want the
// combined shape. The two endpoints produce these independently; nothing
// in production code consumes the merged shape anymore.
export const assessmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['triage', 'workflow'],
  properties: {
    triage: triageSchema,
    workflow: workflowSchema,
  },
}