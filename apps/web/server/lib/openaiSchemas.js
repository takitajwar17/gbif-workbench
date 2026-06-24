// JSON-Schema definitions for the two OpenAI structured-output calls
// (study-intent interpretation and full assessment). Kept separate from
// `openai.js` so the orchestration file focuses on request/response flow
// rather than schema verbosity.

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

export const assessmentSchema = {
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