# Submission Abstract (~205 words)

GBIF Workbench is a pre-download research triage tool for GBIF-mediated
biodiversity data. A user enters a research question in natural language
and GBIF Workbench returns (1) an interpreted scope — taxon resolved
through the GBIF Backbone, region, years, analysis type — (2) a live
GBIF occurrence preview with counts, facets, issue flags, taxonomic
breakdown, coordinate uncertainty, and sampling-event signal, (3)
cautious data-use guidance that names what the available records can
and cannot support, including an explicit refusal when the question
requires data beyond ordinary occurrences, and (4) a reproducible
export package containing R and Python download code, a GBIF predicate
download request, a SQL cube starter query, a cleaning pipeline that
runs CoordinateCleaner when available, methods text, limitations text,
citation instructions, and Quarto and Jupyter notebooks.

GBIF Workbench does not assign a universal data-quality score. It
translates live GBIF availability and quality signals into use-case-
specific research planning guidance, separates data availability from
data suitability from scientific claim strength, and refuses to
overclaim from occurrence-only data. The tool is open-source under
MIT, runs as a public Vercel deployment, and falls back to
deterministic preview-based triage and export generation when the
optional AI calls time out — so the artifact is never blocked by an
AI outage.

# Submission Rationale (~140 words)

Existing GBIF tooling — ChatIPT, BDQEmail, galaxias, GBIF Alert,
CoordinateCleaner, bdc — solves real workflow pain, but mostly
*after* a user has already chosen their data. The underserved stage
is the moment before download, when a researcher has a question and
must decide whether ordinary occurrence records can answer it, what
filters to apply, and whether they are about to misuse presence-only
data for an abundance or trend claim. GBIF Workbench fills that gap
with a transparent, repeatable decision-support layer: live GBIF
preview, cautious fit-for-use guidance, and a reproducible export
package grounded in the actual query the user will run. It complements
downstream cleaning and modelling tools rather than competing with
them, and refuses to overclaim — turning GBIF data discovery into a
defensible research plan rather than a one-click "ready" verdict.