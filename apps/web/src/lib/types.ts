export type AnalysisType =
  | 'distribution_mapping'
  | 'species_distribution_modelling'
  | 'range_shift_exploration'
  | 'temporal_trend_or_abundance'
  | 'invasive_monitoring_preview'
  | 'unknown'

export type PreferredLanguage = 'R' | 'Python' | 'Both'

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'BLOCKING' | 'UNKNOWN'

export type RiskCategory =
  | 'spatial'
  | 'temporal'
  | 'taxonomic'
  | 'source'
  | 'data_type'
  | 'citation'
  | 'other'

export interface StudyIntent {
  question: string
  taxonText: string
  taxonQuery: string
  taxonomicRank: string
  regionText: string
  countries: string[]
  startYear: number | null
  endYear: number | null
  analysisType: AnalysisType
  claimType: string
  requiredData: string[]
  possibleRequiredExtraData: string[]
  spatialResolution: string
  skillLevel: string
  preferredLanguage: PreferredLanguage
  confidence: number
  ambiguities: string[]
}

export interface TaxonResolution {
  scientificName: string
  canonicalName: string
  rank: string
  status: string
  taxonKey: number | null
  confidence: number
  matchType: string
  sourceName: string
  alternatives: TaxonAlternative[]
}

export interface TaxonAlternative {
  scientificName: string
  rank: string
  taxonKey: number | null
  status?: string
}

export interface CountBucket {
  name: string
  count: number
}

export interface OccurrencePoint {
  key: number
  lat: number
  lon: number
  year?: number
  country?: string
  basisOfRecord?: string
  scientificName?: string
  coordinateUncertaintyInMeters?: number
}

export interface DatasetSummary extends CountBucket {
  title?: string
  type?: string
  doi?: string
}

export interface PreviewCounts {
  total: number
  withCoordinates: number
  withUsableCoordinates: number
  withDate: number
  withCoordinatesAndDate: number
}

export interface DataPreview {
  counts: PreviewCounts
  facets: {
    years: CountBucket[]
    countries: CountBucket[]
    basisOfRecord: CountBucket[]
    datasets: DatasetSummary[]
    issues: CountBucket[]
    taxa: CountBucket[]
  }
  samplePoints: OccurrencePoint[]
  coordinateUncertainty: {
    sampledRecords: number
    recordsWithUncertainty: number
    medianMeters: number | null
    over10kmShare: number
  }
  samplingEvents: {
    countriesChecked: string[]
    datasetHits: number
    note: string
  }
  queryUrl: string
  fetchedAt: string
  warnings: string[]
}

export interface Risk {
  category: RiskCategory
  level: RiskLevel
  title: string
  explanation: string
  evidence: string
  whyItMatters: string
  recommendedMitigation: string
  relatedWorkflowStep: string | null
}

export interface SupportClassification {
  headline: string
  stronglySupported: string[]
  conditionallySupported: string[]
  exploratoryOnly: string[]
  notSupportedWithOccurrenceOnly: string[]
  insufficientData: string[]
}

export interface TriageResult {
  support: SupportClassification
  risks: Risk[]
  readiness: {
    spatial: number
    temporal: number
    taxonomic: number
    dataType: number
    // Weighted average using analysis-type-specific dimension weights.
    // Set by the server's normalizeTriage; falls back to flat average
    // if missing.
    average?: number
  }
  recommendedFilters: string[]
  unsupportedClaims: string[]
  nextSteps: string[]
}

export interface AnalysisModels {
  intent?: string
  triage?: string
  workflow?: string
}

export interface GbifQuery {
  apiParams: Record<string, string | number | boolean | string[]>
  apiSearchUrl: string
  gbifSearchUrl: string
  sqlCubeQuery: string
  downloadPredicate: Record<string, unknown>
}

export interface WorkflowPackage {
  rCode: string
  pythonCode: string
  sqlCode: string
  downloadRequestJson: string
  cleaningR: string
  methodsText: string
  limitationsText: string
  citationInstructions: string
  markdownReport: string
  htmlReport: string
  jsonPlan: string
}
