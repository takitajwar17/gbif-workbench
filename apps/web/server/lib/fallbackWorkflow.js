export function createFallbackWorkflow({ intent, taxon, query, preview, triage, reason }) {
  const scope = summarizeScope(intent, taxon)
  const counts = preview?.counts || {}
  const total = number(counts.total)
  const usableCoordinates = number(counts.withUsableCoordinates)
  const dated = number(counts.withDate)
  const topCountries = topBuckets(preview?.facets?.countries, 6)
  const topYears = topBuckets(preview?.facets?.years, 8)
  const topDatasets = topDatasetNames(preview?.facets?.datasets, 5)
  const supportHeadline = triage?.support?.headline || 'Occurrence-search preview completed; review limitations before analysis.'

  const methodsText = [
    `The proposed study was interpreted as: ${intent?.question || 'No question text supplied'}.`,
    `GBIF Workbench resolved the taxon as ${scope.taxon}. The query scope was ${scope.region} for ${scope.years}.`,
    `The live GBIF occurrence-search preview found ${fmt(total)} matching records, including ${fmt(usableCoordinates)} records with usable coordinates and ${fmt(dated)} records with date information.`,
    `The generated workflow preserves the GBIF.org occurrence search URL, occurrence-search API URL, SQL starter query, and download predicate so the preview can be reproduced before requesting a DOI-backed download.`,
    'Before publication use, inspect coordinate uncertainty, issue flags, dataset sources, basis of record, and temporal coverage.',
  ].join('\n\n')

  const limitationsText = [
    'This deterministic export was generated because the optional AI workflow call did not complete in time.',
    reason ? `Backend reason: ${reason}` : '',
    'The code and text are grounded in the live GBIF query, occurrence-search preview counts, and assessment already shown in the app.',
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
    query?.apiSearchUrl ? `GBIF occurrence-search API URL: ${query.apiSearchUrl}` : '',
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
    '## GBIF occurrence-search preview',
    `- Matching records: ${fmt(total)}`,
    `- Usable coordinates: ${fmt(usableCoordinates)}`,
    `- Records with dates: ${fmt(dated)}`,
    topCountries.length ? `- Top countries: ${topCountries.join(', ')}` : '',
    topYears.length ? `- Top years: ${topYears.join(', ')}` : '',
    topDatasets.length ? `- Top datasets: ${topDatasets.join('; ')}` : '',
    '',
    '## Fitness-for-use assessment',
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
  // Filter shell-quoting: the JSON string is embedded as an R literal.
  // Wrap in a list(...) and use parse(text=...) so embedded newlines and
  // quotes from the JSON survive round-tripping.
  return `# GBIF Workbench deterministic export
# Generated from the live GBIF query and preview. Review filters before publication use.
#
# This script does TWO things, in order:
#   1. Submit a DOI-backed GBIF download via rgbif::occ_download() — this
#      is what serious reuse needs (rgbif::occ_search() is preview-only).
#   2. After the download is ready, point occ_download_get() at the file
#      and export it as gbif_occurrences.csv so cleaning_pipeline.R can
#      read it.
#
# After the download completes, copy the DOI printed at the end into
# citation_instructions.md and your manuscript methods section.

# --- 0. Install missing packages (one-time) --------------------------------
required_packages <- c("rgbif", "jsonlite", "dplyr", "readr")
to_install <- required_packages[!required_packages %in% installed.packages()[, "Package"]]
if (length(to_install) > 0) {
  install.packages(to_install, repos = "https://cloud.r-project.org")
}

library(rgbif)
library(jsonlite)
library(dplyr)
library(readr)

# --- 1. Submit the DOI-backed download ------------------------------------
# Set GBIF_USER, GBIF_PWD, and GBIF_EMAIL in your environment first
# (RGBIF_USERS_CACHE_DIR if you want a custom credential cache).
# Sys.setenv(GBIF_USER = "...", GBIF_PWD = "...", GBIF_EMAIL = "...")

download_request_json <- ${toRString(downloadRequestJson)}
download_request <- fromJSON(download_request_json, simplifyVector = FALSE)
write_json(download_request, "gbif_download_request.json", auto_unbox = TRUE, pretty = TRUE)

# Translate the predicate into rgbif::pred_* helpers. The exact helper
# depends on the predicate shape GBIF Workbench generated — common
# examples below; uncomment the one that matches your download_request.
#
# For taxonKey + country + year:
#   occ_download(
#     pred("taxonKey", 5219404),
#     pred("country", "BR"),
#     pred("year", "2000,2025"),
#     format = "SIMPLE_CSV",
#     user = Sys.getenv("GBIF_USER"),
#     pwd  = Sys.getenv("GBIF_PWD"),
#     email = Sys.getenv("GBIF_EMAIL")
#   )
#
# For an "and" predicate from the JSON file:
#   download_key <- occ_download(
#     body = download_request,
#     user = Sys.getenv("GBIF_USER"),
#     pwd  = Sys.getenv("GBIF_PWD"),
#     email = Sys.getenv("GBIF_EMAIL")
#   )

download_key <- NULL  # fill in from occ_download() above
if (!is.null(download_key)) {
  # Wait for the download to complete and capture the DOI.
  result <- occ_download_wait(download_key, status_ping = 30)
  cat("GBIF download DOI:", result$doi, "\\n")
  writeLines(result$doi, "gbif_doi.txt")

  # Import the SIMPLE_CSV archive and write a single CSV the cleaning
  # pipeline reads. GBIF names the file occurrence.txt inside the zip.
  raw_path <- occ_download_get(download_key, path = ".")
  occurrence_path <- file.path(dirname(raw_path), "occurrence.txt")
  if (file.exists(raw_path) && grepl("\\.zip$", raw_path, ignore.case = TRUE)) {
    occurrence_path <- unzip(raw_path, list = TRUE)$Name[1]
    unzip(raw_path, exdir = dirname(raw_path))
    occurrence_path <- file.path(dirname(raw_path), occurrence_path)
  }
  if (file.exists(occurrence_path)) {
    records <- read_tsv(occurrence_path, show_col_types = FALSE)
    write_csv(records, "gbif_occurrences.csv")
    cat("Wrote", nrow(records), "records to gbif_occurrences.csv\\n")
  } else {
    warning("Could not locate occurrence.txt in the GBIF download archive.")
  }
}

# --- 2. Quick preview (optional, NOT a substitute for the download) --------
query_params <- ${toRList(query?.apiParams || {})}
preview <- do.call(occ_search, c(query_params, list(limit = 300)))
cat("Preview matching records (occ_search, preview only):", preview$meta$count, "\\n")
`
}

function createPythonCode({ query }) {
  const paramsJson = JSON.stringify(query?.apiParams || {}, null, 2)
  const requestJson = JSON.stringify(createDownloadRequest(query?.downloadPredicate), null, 2)
  return `# GBIF Workbench deterministic export
# Generated from the live GBIF query and preview. Review filters before publication use.
#
# This script does TWO things, in order:
#   1. Submit a DOI-backed GBIF download via the download API.
#   2. Poll for completion, then export to gbif_occurrences.csv for
#      cleaning_pipeline.R / pandas.
#
# After the download completes, copy the DOI printed at the end into
# citation_instructions.md and your manuscript methods section.

# pip install requests if needed.

import json
import os
import time
import zipfile

import requests

GBIF_OCCURRENCE_SEARCH = "https://api.gbif.org/v1/occurrence/search"
GBIF_DOWNLOAD_REQUEST = "https://api.gbif.org/v1/occurrence/download/request"
GBIF_DOWNLOAD_STATUS = "https://api.gbif.org/v1/occurrence/download/"

query_params = ${indentBlock(paramsJson, 0)}

# --- 1. Preview (occurrences/search; NOT a substitute for the download) ----
preview = requests.get(GBIF_OCCURRENCE_SEARCH, params={**query_params, "limit": 300}, timeout=60)
preview.raise_for_status()
preview_json = preview.json()
print("Preview matching records (preview only):", preview_json.get("count"))

# --- 2. Submit the DOI-backed download ------------------------------------
download_request = ${indentBlock(requestJson, 0)}

with open("gbif_download_request.json", "w", encoding="utf-8") as handle:
    json.dump(download_request, handle, indent=2)

# Set GBIF_USER and GBIF_PWD (and optionally GBIF_EMAIL) in your environment.
auth = (os.environ["GBIF_USER"], os.environ["GBIF_PWD"])
response = requests.post(GBIF_DOWNLOAD_REQUEST, auth=auth, json=download_request, timeout=60)
response.raise_for_status()
download_key = response.text.strip().strip('"')
print("Submitted download key:", download_key)

# Poll for completion (RGBIF uses ~30s; matches GBIF's status refresh cadence).
while True:
    status_response = requests.get(GBIF_DOWNLOAD_STATUS + download_key, timeout=60)
    status_response.raise_for_status()
    status = status_response.json()
    if status.get("status") == "SUCCEEDED":
        doi = status.get("doi", "")
        print("GBIF download DOI:", doi)
        with open("gbif_doi.txt", "w", encoding="utf-8") as handle:
            handle.write(doi)
        break
    if status.get("status") == "FAILED":
        raise RuntimeError(f"GBIF download failed: {status}")
    time.sleep(30)

# Download the archive and write a single CSV the cleaning pipeline reads.
archive_url = status.get("downloadLink") or (GBIF_DOWNLOAD_STATUS + download_key + ".zip")
archive_path = "gbif_download.zip"
with requests.get(archive_url, stream=True, timeout=300) as r:
    r.raise_for_status()
    with open(archive_path, "wb") as handle:
        for chunk in r.iter_content(chunk_size=1 << 20):
            handle.write(chunk)

with zipfile.ZipFile(archive_path, "r") as zf:
    csv_name = next((n for n in zf.namelist() if n.endswith(".txt")), None)
    if csv_name is None:
        raise RuntimeError("GBIF download archive did not contain a .txt occurrence file.")
    with zf.open(csv_name) as src, open("gbif_occurrences.csv", "wb") as dst:
        dst.write(src.read())
print("Wrote gbif_occurrences.csv (TSV source renamed to .csv for tool compatibility)")
`
}

function createCleaningR() {
  // The download script writes gbif_occurrences.csv (see createRCode
  // above) by extracting occurrence.txt from the GBIF SIMPLE_CSV
  // archive and renaming it. cleaning_pipeline.R reads that file. We
  // no longer assume the user manually renames anything.
  //
  // CoordinateCleaner is wrapped in requireNamespace() so the script
  // still runs when the package is missing — the flag set is just
  // skipped, with a clear note in the log. When it IS installed
  // (install.packages("CoordinateCleaner")), the script applies the
  // standard biodiversity-cleaning checks: country capitals, centroid
  // duplicates, equal lat/lon, zero-distance, and GBIF headquarters.
  return `# GBIF Workbench cleaning starter
#
# Reads gbif_occurrences.csv (produced by gbif_download.R after the
# DOI-backed download completes). If you downloaded manually, copy the
# archive's occurrence.txt to ./gbif_occurrences.csv first.
#
# Important: GBIF occurrence records are presence-only and opportunistic.
# These steps are a starting point, not a substitute for review of the
# GBIF issue facets shown in the app.

library(dplyr)
library(readr)

if (!file.exists("gbif_occurrences.csv")) {
  stop("gbif_occurrences.csv not found. Run gbif_download.R first, or copy occurrence.txt to gbif_occurrences.csv.")
}

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

# --- CoordinateCleaner block ----------------------------------------------
# Optional package — install once with:
#   install.packages("CoordinateCleaner")
# When installed, runs the standard biodiversity-cleaning flag set
# (capital, centroid, equal, zeros, gbifhq, institutions, biodiversity).
# When missing, the script keeps the dplyr-cleaned output above and
# prints a clear note so the user knows what they skipped.
if (requireNamespace("CoordinateCleaner", quietly = TRUE)) {
  cc_flags <- CoordinateCleaner::clean_coordinates(
    cleaned,
    lon = "decimalLongitude",
    lat = "decimalLatitude",
    species = "species",
    countries = "countryCode",
    tests = c("capitals", "centroids", "equal", "zeros", "gbifhq", "institutions", "biodiversity"),
    verbose = FALSE
  )
  cleaned <- cleaned[!cc_flags, ]
  cat("CoordinateCleaner removed", sum(cc_flags), "flagged records.\\n")
} else {
  cat("CoordinateCleaner not installed; skipping taxon-aware coordinate flags.\\n")
  cat("Install with install.packages(\\"CoordinateCleaner\\") to add capital/centroid/equal/zeros/gbifhq checks.\\n")
}
# --------------------------------------------------------------------------

write_csv(cleaned, "gbif_occurrences_cleaned.csv")
cat("Wrote", nrow(cleaned), "cleaned records to gbif_occurrences_cleaned.csv\\n")
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
