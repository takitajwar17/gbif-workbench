import { computeReadiness } from './readinessFormula.js'

export function createFallbackTriage({ intent, taxon, preview, reason }) {
  const counts = preview?.counts || {}
  const total = asNumber(counts.total)
  const usableCoordinates = asNumber(counts.withUsableCoordinates)
  const dated = asNumber(counts.withDate)
  const coordinateShare = share(usableCoordinates, total)
  const dateShare = share(dated, total)
  const readiness = computeReadiness(intent, preview)
  const dataTypeReadiness = readiness.dataType
  const supportLevel = deriveSupportLevel({ coordinateShare, dateShare, dataTypeReadiness })
  const unsupportedClaims = occurrenceOnlyUnsupportedClaims(intent)

  const risks = [
    aiFallbackRisk(reason),
    coverageRisk({
      category: 'spatial',
      title: 'Coordinate fitness needs review',
      count: usableCoordinates,
      total,
      share: coordinateShare,
      evidenceLabel: 'Usable coordinate share',
      emptyExplanation: 'No matching occurrence records were found for this scope.',
      countExplanation: 'matching records have usable coordinates.',
      whyItMatters:
        'Distribution maps, range-shift exploration, and spatial models depend on usable, precise coordinates.',
      recommendedMitigation:
        'Require coordinates, remove known coordinate issues, inspect uncertainty, and choose a spatial resolution that matches the data.',
      relatedWorkflowStep: 'Coordinate cleaning',
    }),
    coverageRisk({
      category: 'temporal',
      title: 'Date coverage needs review',
      count: dated,
      total,
      share: dateShare,
      evidenceLabel: 'Date availability share',
      emptyExplanation:
        'No temporal coverage can be assessed because the preview returned no matching records.',
      countExplanation: 'matching records have an event date or year.',
      whyItMatters:
        'Temporal claims require records from the requested window, not just historical presence records.',
      recommendedMitigation:
        'Filter by year, inspect year facets, and avoid trend claims when sampling is sparse or discontinuous.',
      relatedWorkflowStep: 'Temporal filtering',
    }),
    dataTypeRisk(intent, preview),
  ]

  if (needsTaxonReview(taxon)) risks.push(taxonRisk(taxon))

  return {
    support: fallbackSupport({ total, coordinateShare, dateShare, dataTypeReadiness, supportLevel, unsupportedClaims }),
    risks,
    readiness,
    recommendedFilters: fallbackFilters({ intent, total, coordinateShare, dateShare, preview }),
    unsupportedClaims,
    nextSteps: fallbackNextSteps({ total, supportLevel }),
  }
}

function aiFallbackRisk(reason) {
  return risk({
    category: 'other',
    level: 'MODERATE',
    title: 'AI triage unavailable; deterministic triage used',
    explanation:
      'The live GBIF preview completed, but the optional AI triage call did not finish inside the response budget.',
    evidence: reason || 'The AI triage service timed out or returned an incomplete response.',
    whyItMatters:
      'The result is still grounded in live GBIF counts and facets, but the qualitative explanation is rule-based and intentionally conservative.',
    recommendedMitigation:
      'Use the preview, filters, and generated workflow as a starting point, then re-run if you need richer narrative triage.',
    relatedWorkflowStep: 'Review methods and limitations',
  })
}

function coverageRisk({
  category,
  title,
  count,
  total,
  share: coverageShare,
  evidenceLabel,
  emptyExplanation,
  countExplanation,
  whyItMatters,
  recommendedMitigation,
  relatedWorkflowStep,
}) {
  return risk({
    category,
    level: coverageLevel(total, coverageShare),
    title,
    explanation:
      total === 0
        ? emptyExplanation
        : `${count.toLocaleString()} of ${total.toLocaleString()} ${countExplanation}`,
    evidence: `${evidenceLabel}: ${percent(coverageShare)}.`,
    whyItMatters,
    recommendedMitigation,
    relatedWorkflowStep,
  })
}

function dataTypeRisk(intent, preview) {
  const mismatch = occurrenceOnlyMismatch(intent)
  return risk({
    category: 'data_type',
    level: mismatch ? 'HIGH' : 'MODERATE',
    title: 'Occurrence-only data may not support the full claim',
    explanation: mismatch
      ? 'The interpreted study asks for trend, abundance, monitoring, or change inference that usually needs effort, absence, abundance, or protocol data.'
      : 'GBIF occurrence records can support discovery and planning, but final inference depends on analysis-specific assumptions.',
    evidence: `Interpreted analysis type: ${intent?.analysisType || 'unknown'}. Sampling-event datasets surfaced: ${preview?.samplingEvents?.datasetHits || 0}.`,
    whyItMatters:
      'Presence-only occurrence data should not be treated as complete sampling effort or population abundance.',
    recommendedMitigation:
      'Use occurrence data for scope and filtering, then add effort-aware monitoring, environmental, trait, or absence data when the claim requires it.',
    relatedWorkflowStep: 'Data-type triage',
  })
}

function taxonRisk(taxon) {
  return risk({
    category: 'taxonomic',
    level: 'MODERATE',
    title: 'Taxon match should be checked',
    explanation:
      'The resolved GBIF Backbone match is missing or below a high-confidence threshold.',
    evidence: `Taxon key: ${taxon?.taxonKey ?? 'none'}; match confidence: ${taxon?.confidence ?? 'unknown'}.`,
    whyItMatters:
      'Incorrect or high-rank taxon matches can mix records from species that should not be analyzed together.',
    recommendedMitigation:
      'Review the GBIF Backbone match, synonyms, and alternatives before downloading records.',
    relatedWorkflowStep: 'Taxon resolution',
  })
}

function fallbackSupport({ total, coordinateShare, dateShare, supportLevel, unsupportedClaims }) {
  if (total <= 0) {
    return {
      headline: 'No matching GBIF occurrence records were found for this scope.',
      stronglySupported: [],
      conditionallySupported: [],
      exploratoryOnly: [],
      notSupportedWithOccurrenceOnly: unsupportedClaims,
      insufficientData: ['The live GBIF preview returned zero matching records for the interpreted filters.'],
    }
  }

  return {
    headline: fallbackHeadline(supportLevel),
    stronglySupported:
      supportLevel === 'strong' && unsupportedClaims.length === 0
        ? ['Occurrence discovery and reproducible GBIF download planning are well supported by the live preview.']
        : [],
    conditionallySupported: conditionalSupportItems(coordinateShare, dateShare),
    exploratoryOnly:
      supportLevel !== 'strong'
        ? ['Use the preview to refine scope and identify gaps before making inferential claims.']
        : [],
    notSupportedWithOccurrenceOnly: unsupportedClaims,
    insufficientData: [
      ...(coordinateShare < 0.3 ? ['Too few matching records have usable coordinates for reliable spatial inference.'] : []),
      ...(dateShare < 0.3 ? ['Too few matching records have dates for reliable temporal inference.'] : []),
    ],
  }
}

function fallbackHeadline(supportLevel) {
  if (supportLevel === 'strong') return 'GBIF looks usable for a cautious, filter-driven workflow.'
  if (supportLevel === 'mixed') return 'GBIF can support exploratory planning, but key limitations need review.'
  return 'GBIF support looks weak for this scope without additional data or narrower filters.'
}

// Derive a conservative support category from per-dimension readiness
// signals. We deliberately do NOT collapse this into a single weighted
// score: each input is checked independently and the lowest passing
// category wins, because confidence in the analysis is gated by its
// weakest dimension.
function deriveSupportLevel({ coordinateShare, dateShare, dataTypeReadiness }) {
  // dataType < 50 means occurrence-only GBIF data doesn't fit the
  // analysis (e.g. trend/abundance). That's a categorical block, not
  // a numeric one.
  if (dataTypeReadiness < 50) return 'weak'
  if (coordinateShare >= 0.7 && dateShare >= 0.7 && dataTypeReadiness >= 70) return 'strong'
  if (coordinateShare >= 0.3 || dateShare >= 0.3) return 'mixed'
  return 'weak'
}

function conditionalSupportItems(coordinateShare, dateShare) {
  const items = [
    'Live GBIF records can support data discovery, filter planning, and reproducible download preparation for this scope.',
  ]
  if (coordinateShare >= 0.7 && dateShare >= 0.7) {
    items.push('Coordinate and date availability are strong enough to continue into a careful methods review.')
  }
  return items
}

function fallbackFilters({ intent, total, coordinateShare, dateShare, preview }) {
  const filters = ['Preserve the generated GBIF predicate and search URL with the final workflow.']
  if (total > 0) {
    filters.push('Require records with coordinates for spatial analysis.')
    filters.push('Inspect issue facets and remove records with coordinate/date problems before modelling.')
  }
  if (dateShare < 0.9 || intent?.startYear || intent?.endYear) {
    filters.push('Filter records to the requested year window and review the year distribution.')
  }
  if (coordinateShare < 0.9 || preview?.coordinateUncertainty?.over10kmShare > 0) {
    filters.push('Review coordinate uncertainty and choose a spatial resolution that is coarser than typical uncertainty.')
  }
  if (Array.isArray(intent?.countries) && intent.countries.length > 0) {
    filters.push('Keep the country filter explicit and check country facets for unexpected spillover.')
  }
  return filters
}

function fallbackNextSteps({ total, supportLevel }) {
  if (total <= 0) {
    return [
      'Broaden the taxon, geography, or year window and run the analysis again.',
      'Check the taxon spelling and GBIF Backbone match.',
      'If absence, abundance, or monitoring claims are needed, identify additional datasets outside ordinary occurrence records.',
    ]
  }
  return [
    supportLevel === 'strong'
      ? 'Proceed to workflow export, then review generated code before requesting a full GBIF download.'
      : 'Refine the scope and filters before relying on the generated workflow.',
    'Inspect country, year, dataset, basis-of-record, and issue facets before publication use.',
    'Create a DOI-backed GBIF download for any final analysis that uses records beyond preview exploration.',
  ]
}

function occurrenceOnlyUnsupportedClaims(intent) {
  if (!occurrenceOnlyMismatch(intent)) return []
  return [
    'Population abundance, decline, occupancy, or causal trend claims are not supported by ordinary occurrence-only records without effort-aware or monitoring data.',
  ]
}

function occurrenceOnlyMismatch(intent) {
  const text = [
    intent?.analysisType,
    intent?.claimType,
    ...(Array.isArray(intent?.requiredData) ? intent.requiredData : []),
    ...(Array.isArray(intent?.possibleRequiredExtraData) ? intent.possibleRequiredExtraData : []),
  ]
    .join(' ')
    .toLowerCase()
  return /temporal_trend_or_abundance|abundance|decline|population|occupancy|absence|effort|monitoring|trend/.test(text)
}

function coverageLevel(total, value) {
  if (total === 0) return 'BLOCKING'
  if (value < 0.3) return 'HIGH'
  if (value < 0.7) return 'MODERATE'
  return 'LOW'
}

function needsTaxonReview(taxon) {
  return !taxon?.taxonKey || asNumber(taxon?.confidence) < 80
}

function risk({
  category,
  level,
  title,
  explanation,
  evidence,
  whyItMatters,
  recommendedMitigation,
  relatedWorkflowStep,
}) {
  return {
    category,
    level,
    title,
    explanation,
    evidence,
    whyItMatters,
    recommendedMitigation,
    relatedWorkflowStep,
  }
}

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function share(numerator, denominator) {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(1, numerator / denominator))
}

function percent(value) {
  return new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 }).format(value)
}
