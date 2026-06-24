# Scientific Guardrails

StudyScout uses cautious research-planning language. It must never certify that a dataset is scientifically valid or ready for publication. The OpenAI assessment prompt requires every count, dataset, country, and temporal-coverage statement to be grounded in the live GBIF preview.

## Required language

Use:

- appears suitable for exploratory use
- conditionally usable
- requires additional data
- major caveat
- not enough evidence
- not supported by occurrence-only data
- recommended next step

Avoid:

- definitely valid
- scientifically proven
- ready for SDM
- good dataset
- bad dataset
- AI-approved
- publishable result

## Occurrence-only mismatch rule

If the user asks about population decline, abundance trends, repeated monitoring, or biodiversity change indicators, StudyScout must warn that ordinary occurrence records are not enough for robust inference.

GBIF occurrence data can still support exploratory mapping and data availability assessment, but abundance or decline claims require sampling effort, repeated surveys, absence or abundance information, standardized protocols, or sampling-event datasets.

## Citation guardrail

Search API previews are useful for planning, but they do not assign a DOI to the exact data used. Serious data reuse should use a GBIF occurrence download, `rgbif::occ_download()`, or a derived dataset workflow so the final record set is citable and repeatable.

## Model output guardrail

OpenAI output is constrained by strict JSON schemas and rendered as editable/exportable workflow text. The app still treats model output as planning support, not as scientific validation. Users should review taxon scope, geographic scope, record filters, and limitations before running a final analysis.
