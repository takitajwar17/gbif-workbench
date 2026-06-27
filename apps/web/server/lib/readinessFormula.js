// Deterministic readiness scoring.
//
// Replaces the LLM-produced readiness block in the assessment with a
// pure function of the resolved `intent` and the GBIF `DataPreview`.
// Same intent + same preview always returns the same four integers,
// which removes the dominant source of run-to-run variance in the
// four `Readiness` bars shown on the result card.
//
// The four dimensions mirror what ecological researchers evaluate when
// deciding whether GBIF-mediated occurrence data can support a study question:
//   - spatial:   usable coordinate coverage, precision, and country fit
//   - temporal:  date availability, year-window overlap, continuity,
//                recency (for applications that need recent data)
//   - taxonomic: name resolution from GBIF backbone + ambiguity cleanliness
//   - dataType:  whether GBIF occurrence-only data fits the analysis
//                type (per the GBIF literature)
//
// We deliberately do NOT collapse these four dimensions into a single
// "average readiness" score. A single weighted number invites users to
// overclaim ("76/100 — Strong!"), and the same study can be Strong on
// spatial but Weak on temporal in ways a flat score hides. Each
// dimension is reported on its own bar.
//
// Weights and signals were audited against published GBIF methodology
// papers (Beck et al. 2014, Phillips et al. 2009, Araújo & Peterson
// 2012, Elith et al. 2006, Warton et al. 2009, Lister et al. 2011,
// Hughes et al. 2021, plus GBIF's own data-quality flag spec and
// IUCN red-list guidelines). See the README links at the bottom of
// the test file for the canonical citations.
//
// Each dimension is a weighted blend of 2-4 normalized signals, all of
// which come from the preview (no LLM in the loop). All inputs default
// to 0 when missing so the formula never throws on a partial preview.

// ---------------------------------------------------------------------------
// Analysis-type lookup tables
// ---------------------------------------------------------------------------
//
// Base fit: how well GBIF occurrence data fits each analysis type, as
// a 0-1 score. The trends here follow the published consensus:
//
//   - Distribution mapping: GBIF is the canonical source (Graham et al.
//     2004; Rocchini et al. 2011). High base fit.
//   - Species distribution modelling: GBIF can fit correlative SDMs but
//     requires explicit bias correction (Phillips et al. 2009; Araújo
//     & Peterson 2012; Elith et al. 2006). Mid-high base fit.
//   - Range shift: an SDM variant across time. Inherits SDM's issues but
//     well established (Chen et al. 2011). Mid base fit.
//   - Temporal trend / abundance: conflated here. Trend-in-range is
//     possible from GBIF (Lister et al. 2011), but abundance inference
//     is not supported (Warton et al. 2009; Isaac et al. 2014). Mid-low
//     base fit with no sampling-event boost, because sampling-event data
//     is what enables effort-corrected abundance claims.
//   - Invasive monitoring: opportunistic data is GBIF's strength
//     (Latombe et al. 2017). Mid base fit, sampling events help.
//   - Unknown: place-holder when the LLM couldn't classify. Low.
const ANALYSIS_TYPE_BASE_FIT = Object.freeze({
  distribution_mapping: 0.80,
  species_distribution_modelling: 0.60,
  range_shift_exploration: 0.55,
  temporal_trend_or_abundance: 0.35, // trend OK; abundance NOT supported
  invasive_monitoring_preview: 0.65,
  unknown: 0.30,
})

// Sampling-event boost: when the preview surfaced sampling-event
// datasets (samplingEvents.datasetHits > 0), the data carries
// effort information, which is exactly what is missing from typical
// opportunistic aggregations. This is the biggest single unlock for
// abundance-aware analyses, so the boost is largest there.
const ANALYSIS_TYPE_SAMPLING_BOOST = Object.freeze({
  distribution_mapping: 0.20,
  species_distribution_modelling: 0.25,
  range_shift_exploration: 0.20,
  temporal_trend_or_abundance: 0.15,
  invasive_monitoring_preview: 0.15,
  unknown: 0.05,
})

// Issue flags the GBIF API can return. See gbif.org/data-quality-requirements
// for the full list. We use a curated subset that is meaningful for
// fitness-for-use evaluation.
const DATE_ISSUE_FLAGS = ['ZERO_COORDINATE', 'NO_DATE']
const TAXON_ISSUE_FLAGS = [
  'TAXON_MATCH_NONE', // record's taxon didn't resolve
  'TAXON_MATCH_FUZZY', // fuzzy match — likely wrong taxon
  'TAXON_MATCH_HIGHERRANK', // matched at a higher rank than requested
]

// Taxonomy "interpretation clarity" is the LLM's confidence in the
// interpretation of the question, NOT confidence in name resolution
// accuracy. They are different things; the GBIF literature is clear
// that LLM confidence is not a calibrated measure of taxonomic
// validity. We still include it (lightly) because a low LLM
// confidence means the user's question was ambiguous, which is a real
// signal that the analysis is not well-targeted.
const TAXON_SIGNAL_WEIGHTS = Object.freeze({
  backboneMatch: 0.40, // GBIF returned any taxon at all in preview.facets.taxa
  fuzzyPenalty: 0.20, // penalize based on share of records flagged with TAXON_MATCH_*
  ambiguityClean: 0.20, // 0 ambiguities = 1, 1 = 0.7, 2+ = 0.4
  interpretationClarity: 0.20, // LLM confidence in the interpretation
})

const SPATIAL_SIGNAL_WEIGHTS = Object.freeze({
  usableCoords: 0.45,
  coordinatePrecision: 0.35,
  countryContainment: 0.20,
})

const TEMPORAL_SIGNAL_WEIGHTS = Object.freeze({
  dateAvailability: 0.30,
  yearWindowOverlap: 0.25,
  temporalContinuity: 0.25,
  recency: 0.20,
})

const DATA_TYPE_SIGNAL_WEIGHTS = Object.freeze({
  analysisFit: 1.0, // the lookup-table signal is already a multi-component blend
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0
  const ratio = numerator / denominator
  return clamp(ratio, 0, 1)
}

function score01(value) {
  return clamp(Math.round(value * 100), 0, 100)
}

function blend(parts) {
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0)
  if (totalWeight <= 0) return 0
  const weighted = parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight
  return score01(weighted)
}

function getPreviewCounts(preview) {
  return preview?.counts || {}
}

function totalRecords(preview) {
  return getPreviewCounts(preview).total || 0
}

function numCountriesInPreview(preview) {
  const facets = preview?.facets?.countries
  return Array.isArray(facets) ? facets.length : 0
}

function yearSpanCoverage(preview, startYear, endYear) {
  if (!startYear && !endYear) return 1 // no time constraint — full coverage is automatic
  const years = preview?.facets?.years
  if (!Array.isArray(years) || years.length === 0) return 0

  let lo = Infinity
  let hi = -Infinity
  for (const bucket of years) {
    const name = Number(bucket?.name)
    if (Number.isFinite(name)) {
      if (name < lo) lo = name
      if (name > hi) hi = name
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0

  const reqLo = startYear || lo
  const reqHi = endYear || hi
  const overlapLo = Math.max(lo, reqLo)
  const overlapHi = Math.min(hi, reqHi)
  if (overlapHi < overlapLo) return 0
  const requestedSpan = Math.max(1, reqHi - reqLo + 1)
  const overlapSpan = overlapHi - overlapLo + 1
  return clamp(overlapSpan / requestedSpan, 0, 1)
}

function issuesShare(preview, flagList) {
  if (!Array.isArray(flagList) || flagList.length === 0) return 0
  const issues = preview?.facets?.issues
  if (!Array.isArray(issues) || issues.length === 0) return 0
  const total = issues.reduce((sum, b) => sum + (Number(b.count) || 0), 0)
  if (total <= 0) return 0
  const wanted = new Set(flagList)
  const flagged = issues
    .filter((b) => wanted.has(String(b.name)))
    .reduce((sum, b) => sum + (Number(b.count) || 0), 0)
  return clamp(flagged / total, 0, 1)
}

// Longest consecutive gap in the year facet, as a fraction of the
// requested window length. A 5-year gap in a 10-year window = 0.5
// (bad). A 1-year gap in a 30-year window = 0.03 (fine).
//
// This is the "temporal continuity" signal Lister et al. (2011) call
// out: a wall of records followed by silence breaks trend analyses.
// If no year constraint is given, continuity is automatic (1).
function temporalContinuity(preview, startYear, endYear) {
  const years = preview?.facets?.years
  if (!Array.isArray(years) || years.length === 0) return 0

  // Build a sorted list of year buckets present in the preview.
  const present = []
  for (const bucket of years) {
    const n = Number(bucket?.name)
    if (Number.isFinite(n)) present.push(n)
  }
  if (present.length === 0) return 0
  present.sort((a, b) => a - b)

  // If the user gave a window, measure gaps relative to that window.
  // Otherwise, use the preview's own [lo, hi] span.
  const lo = startYear || present[0]
  const hi = endYear || present[present.length - 1]
  const span = Math.max(1, hi - lo + 1)

  // Walk sorted years; longest run of consecutive years that is
  // missing between two present years.
  let longestGap = 0
  for (let i = 1; i < present.length; i++) {
    const gap = present[i] - present[i - 1] - 1
    if (gap > longestGap) longestGap = gap
  }
  // Also penalize the leading/trailing gap between the requested window
  // and the first/last year present.
  const leadingGap = Math.max(0, present[0] - lo)
  const trailingGap = Math.max(0, hi - present[present.length - 1])
  longestGap = Math.max(longestGap, leadingGap, trailingGap)

  // Score: 1 when no gap, 0 when the gap fills the whole window.
  const gapFraction = clamp(longestGap / span, 0, 1)
  return clamp(1 - gapFraction, 0, 1)
}

// Share of records dated within the last `windowYears` years from now.
// Researchers working on invasive species monitoring, conservation
// prioritization, and red-list assessments care disproportionately
// about recent data. IUCN recency rules (10-year window for most
// assessments) are the canonical reference.
//
// The "current year" is taken from preview.fetchedAt when available
// (so the score is reproducible across requests within the same GBIF
// snapshot), otherwise the current calendar year at call time.
function recencyShare(preview, windowYears = 10) {
  const years = preview?.facets?.years
  if (!Array.isArray(years) || years.length === 0) return 0

  // Anchor: prefer preview.fetchedAt so two requests on the same
  // preview return the same recency score.
  const fetchedAt = preview?.fetchedAt
  let anchorYear
  if (typeof fetchedAt === 'string' && fetchedAt.length >= 4) {
    const parsed = Number(fetchedAt.slice(0, 4))
    if (Number.isFinite(parsed)) anchorYear = parsed
  }
  if (!Number.isFinite(anchorYear)) anchorYear = new Date().getFullYear()

  const cutoff = anchorYear - windowYears
  let recent = 0
  let total = 0
  for (const bucket of years) {
    const n = Number(bucket?.name)
    const c = Number(bucket?.count)
    if (!Number.isFinite(n) || !Number.isFinite(c)) continue
    total += c
    if (n >= cutoff) recent += c
  }
  return pct(recent, total)
}

// ---------------------------------------------------------------------------
// Signal extractors
// ---------------------------------------------------------------------------

function taxonSignals(intent, preview) {
  const taxaFacet = Array.isArray(preview?.facets?.taxa) ? preview.facets.taxa : []
  const backboneMatch = taxaFacet.length > 0 ? 1 : 0
  // Fuzzy-penalty signal: share of records flagged with TAXON_MATCH_*
  // issues. 0 share = clean (1.0); all records flagged = 0.
  const fuzzyPenaltyRaw = issuesShare(preview, TAXON_ISSUE_FLAGS)
  const fuzzyPenalty = clamp(1 - fuzzyPenaltyRaw, 0, 1)
  const ambiguities = Array.isArray(intent?.ambiguities) ? intent.ambiguities.length : 0
  const ambiguityClean = ambiguities === 0 ? 1 : ambiguities === 1 ? 0.7 : 0.4
  const confidenceRaw = typeof intent?.confidence === 'number' ? intent.confidence : 0
  const interpretationClarity = clamp(confidenceRaw, 0, 1)
  return { backboneMatch, fuzzyPenalty, ambiguityClean, interpretationClarity }
}

function dataTypeSignals(intent, samplingEventHits) {
  const type = typeof intent?.analysisType === 'string' ? intent.analysisType : 'unknown'
  const base = ANALYSIS_TYPE_BASE_FIT[type] ?? ANALYSIS_TYPE_BASE_FIT.unknown
  const boost = samplingEventHits > 0 ? (ANALYSIS_TYPE_SAMPLING_BOOST[type] ?? 0) : 0
  return { analysisFit: clamp(base + boost, 0, 1) }
}

// ---------------------------------------------------------------------------
// Dimension scorers
// ---------------------------------------------------------------------------

function spatialScore(intent, preview) {
  const counts = getPreviewCounts(preview)
  const total = counts.total || 0
  if (total <= 0) return 0
  const usableRatio = pct(counts.withUsableCoordinates, total)
  const uncertainty = preview?.coordinateUncertainty
  const over10km = typeof uncertainty?.over10kmShare === 'number' ? uncertainty.over10kmShare : 0
  const coordinatePrecision = clamp(1 - over10km, 0, 1)
  const numCountries = numCountriesInPreview(preview)
  const requested = Array.isArray(intent?.countries) && intent.countries.length > 0 ? intent.countries.length : 10
  const countryContainment = clamp(numCountries / requested, 0, 1)
  return blend([
    { value: usableRatio, weight: SPATIAL_SIGNAL_WEIGHTS.usableCoords },
    { value: coordinatePrecision, weight: SPATIAL_SIGNAL_WEIGHTS.coordinatePrecision },
    { value: countryContainment, weight: SPATIAL_SIGNAL_WEIGHTS.countryContainment },
  ])
}

function temporalScore(intent, preview) {
  const counts = getPreviewCounts(preview)
  const total = counts.total || 0
  if (total <= 0) return 0
  const dateAvailability = pct(counts.withDate, total)
  const yearWindowOverlap = yearSpanCoverage(preview, intent?.startYear, intent?.endYear)
  const continuity = temporalContinuity(preview, intent?.startYear, intent?.endYear)
  const recency = recencyShare(preview, 10)
  return blend([
    { value: dateAvailability, weight: TEMPORAL_SIGNAL_WEIGHTS.dateAvailability },
    { value: yearWindowOverlap, weight: TEMPORAL_SIGNAL_WEIGHTS.yearWindowOverlap },
    { value: continuity, weight: TEMPORAL_SIGNAL_WEIGHTS.temporalContinuity },
    { value: recency, weight: TEMPORAL_SIGNAL_WEIGHTS.recency },
  ])
}

function taxonomicScore(intent, preview) {
  const { backboneMatch, fuzzyPenalty, ambiguityClean, interpretationClarity } = taxonSignals(intent, preview)
  return blend([
    { value: backboneMatch, weight: TAXON_SIGNAL_WEIGHTS.backboneMatch },
    { value: fuzzyPenalty, weight: TAXON_SIGNAL_WEIGHTS.fuzzyPenalty },
    { value: ambiguityClean, weight: TAXON_SIGNAL_WEIGHTS.ambiguityClean },
    { value: interpretationClarity, weight: TAXON_SIGNAL_WEIGHTS.interpretationClarity },
  ])
}

function dataTypeScore(intent, preview) {
  const { analysisFit } = dataTypeSignals(intent, preview?.samplingEvents?.datasetHits || 0)
  return blend([{ value: analysisFit, weight: DATA_TYPE_SIGNAL_WEIGHTS.analysisFit }])
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeReadiness(intent, preview) {
  const safeIntent = intent || {}
  const safePreview = preview || {}
  const total = totalRecords(safePreview)
  if (total <= 0) {
    return { spatial: 0, temporal: 0, taxonomic: 0, dataType: 0 }
  }
  return {
    spatial: spatialScore(safeIntent, safePreview),
    temporal: temporalScore(safeIntent, safePreview),
    taxonomic: taxonomicScore(safeIntent, safePreview),
    dataType: dataTypeScore(safeIntent, safePreview),
  }
}

export const __INTERNALS = Object.freeze({
  ANALYSIS_TYPE_BASE_FIT,
  ANALYSIS_TYPE_SAMPLING_BOOST,
  TAXON_ISSUE_FLAGS,
  DATE_ISSUE_FLAGS,
  spatialScore,
  temporalScore,
  taxonomicScore,
  dataTypeScore,
  temporalContinuity,
  recencyShare,
})
