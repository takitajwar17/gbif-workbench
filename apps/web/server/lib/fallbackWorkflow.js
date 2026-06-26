export function createFallbackWorkflow({ intent, taxon, query, preview, triage, reason }) {
  const scope = summarizeScope(intent, taxon)
  const counts = preview?.counts || {}
  const total = number(counts.total)
  const usableCoordinates = number(counts.withUsableCoordinates)
  const dated = number(counts.withDate)
  const topCountries = topBuckets(preview?.facets?.countries, 6)
  const topYears = topBuckets(preview?.facets?.years, 8)
  const topDatasets = topDatasetNames(preview?.facets?.datasets, 5)
  const supportHeadline = triage?.support?.headline || 'GBIF preview completed; review limitations before analysis.'

  const methodsText = [
    `The proposed study was interpreted as: ${intent?.question || 'No question text supplied'}.`,
    `GBIF Workbench resolved the taxon as ${scope.taxon}. The query scope was ${scope.region} for ${scope.years}.`,
    `The live GBIF occurrence preview found ${fmt(total)} matching records, including ${fmt(usableCoordinates)} records with usable coordinates and ${fmt(dated)} records with date information.`,
    `The generated workflow preserves the GBIF search URL, occurrence API URL, SQL starter query, and download predicate so the preview can be reproduced before requesting a DOI-backed download.`,
    'Before publication use, inspect coordinate uncertainty, issue flags, dataset sources, basis of record, and temporal coverage.',
  ].join('\n\n')

  const limitationsText = [
    'This deterministic export was generated because the optional AI workflow call did not complete in time.',
    reason ? `Backend reason: ${reason}` : '',
    'The code and text are grounded in the live GBIF query, preview counts, and triage already shown in the app.',
    'GBIF occurrence records are presence-oriented and opportunistic unless paired with sampling-event, monitoring, effort, absence, or abundance data.',
    'Do not interpret record counts as abundance. Treat gaps in countries, years, datasets, and coordinate precision as study-design limitations.',
    ...(Array.isArray(preview?.warnings) ? preview.warnings : []),
  ]
    .filter(Boolean)
    .join('\n\n')

  const citationInstructions = [
    'For exploratory preview use, cite GBIF and document the query URL used by GBIF Workbench.',
    'For analysis or publication, create a GBIF download through GBIF.org, rgbif::occ_download(), or the GBIF download API, then cite the download DOI returned by GBIF.',
    'Keep the generated predicate JSON and query parameters with your analysis files so reviewers can reproduce the data request.',
    query?.gbifSearchUrl ? `GBIF search URL: ${query.gbifSearchUrl}` : '',
    query?.apiSearchUrl ? `GBIF API preview URL: ${query.apiSearchUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const markdownReport = [
    '# GBIF Workbench Report',
    '## Study scope',
    `- Question: ${intent?.question || 'Not supplied'}`,
    `- Taxon: ${scope.taxon}`,
    `- Region: ${scope.region}`,
    `- Years: ${scope.years}`,
    `- Analysis type: ${intent?.analysisType || 'unknown'}`,
    '',
    '## Live GBIF preview',
    `- Matching records: ${fmt(total)}`,
    `- Usable coordinates: ${fmt(usableCoordinates)}`,
    `- Records with dates: ${fmt(dated)}`,
    topCountries.length ? `- Top countries: ${topCountries.join(', ')}` : '',
    topYears.length ? `- Top years: ${topYears.join(', ')}` : '',
    topDatasets.length ? `- Top datasets: ${topDatasets.join('; ')}` : '',
    '',
    '## Support verdict',
    supportHeadline,
    '',
    '## Recommended filters',
    bulletList(triage?.recommendedFilters),
    '',
    '## Main risks',
    bulletList((triage?.risks || []).map((risk) => `${risk.level}: ${risk.title} - ${risk.explanation}`)),
    '',
    '## Methods',
    methodsText,
    '',
    '## Limitations',
    limitationsText,
    '',
    '## Citation',
    citationInstructions,
  ]
    .filter((line) => line !== '')
    .join('\n')

  return {
    rCode: createRCode({ query }),
    pythonCode: createPythonCode({ query }),
    cleaningR: createCleaningR(),
    methodsText,
    limitationsText,
    citationInstructions,
    markdownReport,
    htmlReport: markdownToSimpleHtml(markdownReport),
  }
}

function createRCode({ query }) {
  const downloadRequestJson = JSON.stringify(createDownloadRequest(query?.downloadPredicate), null, 2)
  return `# GBIF Workbench deterministic export
# Generated from the live GBIF query and preview. Review filters before publication use.

library(rgbif)
library(jsonlite)

query_params <- ${toRList(query?.apiParams || {})}

# Preview records. Increase limit only for exploratory inspection.
preview <- do.call(occ_search, c(query_params, list(limit = 300)))
print(preview$meta$count)

# Serious reuse should create a DOI-backed GBIF download.
# Set GBIF_USER, GBIF_PWD, and GBIF_EMAIL in your environment first.
download_request_json <- ${toRString(downloadRequestJson)}
download_request <- fromJSON(download_request_json, simplifyVector = FALSE)
write_json(download_request, "gbif_download_request.json", auto_unbox = TRUE, pretty = TRUE)

# Option A: submit gbif_download_request.json through the GBIF download API.
# Option B: translate the predicate into rgbif::pred_* helpers and run occ_download().
# Keep the returned GBIF DOI with every downstream analysis.
`
}

function createPythonCode({ query }) {
  const paramsJson = JSON.stringify(query?.apiParams || {}, null, 2)
  const requestJson = JSON.stringify(createDownloadRequest(query?.downloadPredicate), null, 2)
  return `# GBIF Workbench deterministic export
# Generated from the live GBIF query and preview. Review filters before publication use.

import json
import os
import requests

GBIF_OCCURRENCE_SEARCH = "https://api.gbif.org/v1/occurrence/search"
GBIF_DOWNLOAD_REQUEST = "https://api.gbif.org/v1/occurrence/download/request"

query_params = ${indentBlock(paramsJson, 0)}

preview = requests.get(GBIF_OCCURRENCE_SEARCH, params={**query_params, "limit": 300}, timeout=60)
preview.raise_for_status()
preview_json = preview.json()
print("Matching records:", preview_json.get("count"))

download_request = ${indentBlock(requestJson, 0)}

with open("gbif_download_request.json", "w", encoding="utf-8") as handle:
    json.dump(download_request, handle, indent=2)

# Serious reuse should create a DOI-backed GBIF download.
# Set GBIF_USER and GBIF_PWD before uncommenting.
# response = requests.post(
#     GBIF_DOWNLOAD_REQUEST,
#     auth=(os.environ["GBIF_USER"], os.environ["GBIF_PWD"]),
#     json=download_request,
#     timeout=60,
# )
# response.raise_for_status()
# print("GBIF download key:", response.text)
`
}

function createCleaningR() {
  return `# GBIF Workbench cleaning starter

library(dplyr)
library(readr)

records <- read_csv("gbif_occurrences.csv", show_col_types = FALSE)

cleaned <- records %>%
  filter(!is.na(decimalLatitude), !is.na(decimalLongitude)) %>%
  filter(is.na(hasGeospatialIssues) | hasGeospatialIssues == FALSE) %>%
  filter(is.na(year) | year >= 1800) %>%
  distinct(gbifID, .keep_all = TRUE)

if ("coordinateUncertaintyInMeters" %in% names(cleaned)) {
  cleaned <- cleaned %>%
    mutate(coordinateUncertaintyInMeters = as.numeric(coordinateUncertaintyInMeters))
}

write_csv(cleaned, "gbif_occurrences_cleaned.csv")

# Optional: if CoordinateCleaner is installed, add taxon-specific coordinate checks:
# CoordinateCleaner::clean_coordinates(cleaned, lon = "decimalLongitude", lat = "decimalLatitude")
`
}

function summarizeScope(intent, taxon) {
  return {
    taxon: taxon?.scientificName || intent?.taxonText || 'Unspecified taxon',
    region: intent?.regionText || formatCountries(intent?.countries),
    years: formatYears(intent?.startYear, intent?.endYear),
  }
}

function createDownloadRequest(predicate) {
  return {
    notificationAddresses: ['userEmail@example.org'],
    sendNotification: true,
    format: 'SIMPLE_CSV',
    predicate: predicate || { type: 'and', predicates: [] },
  }
}

function toRList(value) {
  if (Array.isArray(value)) return `c(${value.map(toRValue).join(', ')})`
  if (value && typeof value === 'object') {
    const fields = Object.entries(value).map(([key, item]) => `${key} = ${toRValue(item)}`)
    return `list(${fields.join(', ')})`
  }
  return toRValue(value)
}

function toRValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return toRList(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return String(value)
  if (value === null || value === undefined) return 'NULL'
  return JSON.stringify(String(value))
}

function toRString(value) {
  return JSON.stringify(String(value))
}

function formatCountries(countries) {
  if (!Array.isArray(countries) || countries.length === 0) return 'Worldwide or unresolved region'
  return countries.join(', ')
}

function formatYears(startYear, endYear) {
  if (startYear && endYear) return `${startYear}-${endYear}`
  if (startYear) return `${startYear}-present`
  if (endYear) return `through ${endYear}`
  return 'Any year'
}

function topBuckets(buckets, limit) {
  if (!Array.isArray(buckets)) return []
  return buckets.slice(0, limit).map((bucket) => `${bucket.name} (${fmt(bucket.count)})`)
}

function topDatasetNames(datasets, limit) {
  if (!Array.isArray(datasets)) return []
  return datasets.slice(0, limit).map((dataset) => `${dataset.title || dataset.name} (${fmt(dataset.count)})`)
}

function bulletList(items) {
  if (!Array.isArray(items) || items.length === 0) return '- None flagged in the current preview.'
  return items.map((item) => `- ${item}`).join('\n')
}

function markdownToSimpleHtml(markdown) {
  const body = markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`
      if (line.startsWith('- ')) return `<p>${escapeHtml(line)}</p>`
      if (!line.trim()) return ''
      return `<p>${escapeHtml(line)}</p>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GBIF Workbench Report</title>
</head>
<body>
${body}
</body>
</html>
`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function indentBlock(value, spaces) {
  const pad = ' '.repeat(spaces)
  return value
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n')
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function fmt(value) {
  return new Intl.NumberFormat('en').format(number(value))
}
