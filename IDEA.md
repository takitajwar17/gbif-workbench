# Product Requirements Document

# GBIF Workbench

## 1. Product Name

**GBIF Workbench**

## 2. One-Line Pitch

**GBIF Workbench helps researchers decide whether, when, and how GBIF-mediated data can support a proposed biodiversity study before they download the data.**

## 3. Longer Product Description

GBIF Workbench is a bias-aware research triage and workflow-generation tool for GBIF-mediated biodiversity data.

A user enters a research question in natural language, for example:

> “I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.”

GBIF Workbench interprets the research intent, identifies the relevant taxonomic, geographic, temporal, and analytical scope, previews GBIF data availability, detects likely data-use risks, warns when the requested research question requires data types beyond ordinary occurrence records, and generates a reproducible GBIF data-use workflow.

The tool does **not** claim that a dataset is universally “good” or “bad.” Instead, it answers a more scientifically defensible question:

> “Given this research goal, what can GBIF data support, what can it not support, what are the major limitations, and what exact workflow should the user follow?”

## 4. Why This Product Exists

GBIF provides massive open biodiversity data, but many users struggle before analysis even begins. They may not know:

* Which GBIF records or datasets are relevant.
* Whether ordinary occurrence records are enough.
* Whether they need sampling-event, abundance, effort, absence, media, molecular, or checklist data.
* How biased the data may be.
* Which GBIF filters to use.
* Whether the data can support their scientific claim.
* How to cite and reproduce the download.
* Whether they are about to misuse GBIF data.

The core problem is not simply data quality. It is **research-design uncertainty**.

Many tools help users download, clean, or validate data after they already know what they want. GBIF Workbench operates earlier:

```text
Research idea
↓
Can GBIF support this?
↓
What data type is needed?
↓
What data exists?
↓
What are the gaps and biases?
↓
What can/cannot be claimed?
↓
What query and workflow should be used?
↓
Reproducible notebook and report
```

This is the strategic wedge.

## 5. Competition Context

This product is intended as a submission for the **2026 GBIF Ebbe Nielsen Challenge**.

The challenge rewards tools, workflows, analyses, and prototypes that improve the access, usefulness, quality, openness, and repeatability of GBIF-mediated biodiversity data.

Recent winning projects show a clear pattern:

* They solve practical GBIF workflow problems.
* They reduce friction for real users.
* They are easy to demo.
* They produce immediate value.
* They are open and repeatable.
* They avoid being merely flashy visualizations.

Relevant recent winners include:

* **GBIF Alert**: alert system for new occurrence records.
* **ChatIPT**: helps transform messy spreadsheets into GBIF-ready standardized datasets.
* **BDQEmail**: makes biodiversity data-quality checks accessible through email.
* **galaxias**: helps researchers create Darwin Core Archives in R/Python workflows.
* **BAM**: embeddable local biodiversity widget using GBIF-mediated data.

GBIF Workbench should follow that pattern:

```text
Painful GBIF workflow
↓
simple interface
↓
practical output
↓
open, reproducible implementation
```

But it should target an under-served stage: **pre-download research planning and data-use triage.**

## 6. Core Strategic Insight

Do **not** build:

> “Upload a dataset and get a readiness score.”

That starts too late and risks scientific overclaiming.

Do **not** build:

> “A dashboard showing bias in GBIF data.”

Bias tools already exist.

Do **not** build:

> “ChatGPT for GBIF.”

Too generic and weak on repeatability.

Build:

> “A structured pre-download decision-support tool that turns a biodiversity research question into a defensible GBIF data-use plan.”

## 7. Product Positioning

### Bad Positioning

“AI tells you whether your dataset is suitable for species distribution modelling.”

This is scientifically dangerous because suitability depends on:

* The exact modelling method.
* Taxon.
* Spatial scale.
* Temporal scale.
* Geographic region.
* Sampling bias.
* Environmental predictors.
* Presence-only vs presence-absence requirements.
* Quality thresholds.
* Research claim strength.

### Good Positioning

“GBIF Workbench helps users understand whether GBIF-mediated data can support a proposed study, what assumptions and limitations apply, and what reproducible workflow to use.”

### Even Better Positioning

“GBIF Workbench prevents bad GBIF data use before it happens.”

## 8. Primary Users

### 8.1 Graduate Students and Early-Career Researchers

They have research questions but may not know how to translate them into GBIF queries, filters, and reproducible workflows.

Example need:

> “Can I use GBIF to study range shifts of this taxon over time?”

### 8.2 Biodiversity Researchers

They understand ecology but may not be GBIF/API/R/Python experts.

Example need:

> “Which GBIF filters should I use for a defensible SDM workflow?”

### 8.3 Conservation Practitioners and NGOs

They need practical answers for monitoring, invasive species, conservation status, or regional biodiversity assessment.

Example need:

> “Can GBIF data support an invasive species monitoring plan in this region?”

### 8.4 GBIF Node Staff and Data Trainers

They need teaching and support tools that help users avoid common mistakes.

Example need:

> “Show trainees why occurrence-only data cannot answer every biodiversity trend question.”

### 8.5 Policy and Assessment Users

They need to understand if GBIF-mediated data is strong enough for policy-relevant claims.

Example need:

> “Can this data support a biodiversity change indicator, or does it only support exploratory mapping?”

## 9. User Problems

### Problem 1: Users Start with Vague Research Questions

Users often begin with:

> “I want to study climate change impact on butterflies in South Asia.”

They do not immediately know:

* Which taxa to query.
* Which countries/regions to include.
* Which years matter.
* Which GBIF record types are useful.
* Whether the data supports trend inference or only mapping.

### Problem 2: Occurrence Records Are Often Misused

Presence-only occurrence data is useful, but not enough for every research question.

GBIF Workbench must warn users when their question requires:

* Sampling effort.
* Absence data.
* Abundance data.
* Repeated monitoring.
* Standardized protocols.
* Event-level metadata.
* Survey method information.

### Problem 3: Users Confuse “Available Data” with “Appropriate Data”

A region may have many occurrence records but still be poor for a particular study because of:

* Urban sampling bias.
* Citizen-science concentration.
* Protected-area bias.
* Temporal clustering.
* Country imbalance.
* Lack of pre-2000 records.
* Taxonomic uncertainty.
* Coarse coordinates.
* Missing event dates.
* Dataset duplication.

### Problem 4: Users Download First and Think Later

Many workflows start with downloading massive data first. GBIF Workbench should reverse this:

> Think first. Download second.

### Problem 5: Reproducibility Is Hard

Users may click around GBIF.org, export a file, clean manually, and later struggle to reproduce the exact query.

GBIF Workbench should generate:

* GBIF.org search URL.
* rgbif download code.
* Python/pygbif code where possible.
* SQL/cube query where useful.
* Methods text.
* Citation instructions.
* Cleaning pipeline.

## 10. Product Goals

### Goal 1: Pre-Download Research Triage

Given a research question, determine what type of GBIF-mediated data is needed and whether GBIF likely has enough relevant data to proceed.

### Goal 2: Bias-Aware Data Preview

Show data availability and likely limitations before full download.

### Goal 3: Scientific Claim Guardrails

Clearly distinguish what the data can support from what it cannot support.

Example:

```text
Supported:
- Exploratory distribution mapping
- Preliminary SDM

Conditionally supported:
- Range-shift analysis, with strong caveats

Not supported by occurrence-only data:
- Population decline inference
- Abundance trend estimation
```

### Goal 4: Reproducible Workflow Generation

Generate code and documentation the user can run.

### Goal 5: Educational Value

Help users understand GBIF data limitations in plain language without hiding the underlying technical details.

### Goal 6: Open and Repeatable Challenge Submission

The entire tool must be:

* Open-source.
* Documented.
* Reproducible.
* Runnable by judges.
* Demonstrable in under 3 minutes.
* Useful without paid APIs where possible.

## 11. Non-Goals

GBIF Workbench should **not** attempt to do everything.

### Non-Goal 1: It Is Not a Universal Biodiversity Research Assistant

Do not build a generic “ask anything about biodiversity” chatbot.

### Non-Goal 2: It Is Not a Full SDM Platform

Do not build MaxEnt, biomod2, ENMeval, or full ecological modelling inside v1.

Instead, generate a starter notebook and recommended preprocessing steps.

### Non-Goal 3: It Is Not a Replacement for Expert Judgment

Never claim:

> “This dataset is scientifically valid.”

Use:

> “Based on these checks, this data appears appropriate for X under Y assumptions, but not for Z.”

### Non-Goal 4: It Is Not a Data Cleaning Tool First

It may generate cleaning steps, but the main value is planning and triage before download.

### Non-Goal 5: It Is Not a Bias Tool Wrapper Only

Using CoordinateCleaner, sampbias, or occAssess is fine, but the product must add the planning layer.

### Non-Goal 6: It Is Not a GBIF Occurrence Cube Viewer

GBIF already supports occurrence cubes. GBIF Workbench should use cubes, not merely repackage them.

## 12. MVP Scope

The MVP should support **two research modes**.

### Mode 1: Distribution / Range-Shift Planning

This is the main mode.

Supported questions:

* Species distribution modelling.
* Exploratory distribution mapping.
* Climate-envelope style planning.
* Range-shift preliminary assessment.
* Taxon-by-region occurrence suitability.

Example inputs:

```text
I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.
```

```text
Can I model the distribution of Panthera leo in Africa using GBIF data?
```

```text
I want to compare orchid records in Bangladesh before and after 2000.
```

### Mode 2: Trend / Abundance Triage

This is the differentiator.

Supported questions:

* Population decline.
* Abundance trends.
* Temporal monitoring.
* Biodiversity change claims.
* Community ecology claims requiring repeated sampling.

Example inputs:

```text
Are frog populations declining in Bangladesh since 2000?
```

```text
Can I use GBIF to estimate abundance trends of freshwater fish in India?
```

For this mode, the tool should often warn:

> “Occurrence-only data is not sufficient for robust abundance or population trend inference. Look for sampling-event or monitoring datasets with effort/absence/abundance information.”

## 13. Future Modes

Do not build these in MVP, but design architecture to support them later.

### Future Mode 1: Invasive Species Monitoring

Questions:

* Where are new invasive records appearing?
* Is GBIF enough for monitoring spread?
* Which records are recent and credible?

### Future Mode 2: Red List / Conservation Assessment

Questions:

* Can occurrence data support extent of occurrence or area of occupancy estimation?
* Are records recent enough?
* Are coordinates precise enough?

### Future Mode 3: Agrobiodiversity

Questions:

* Are crop wild relative records sufficient?
* Are genetic resources/geographic provenance data adequate?

### Future Mode 4: Human Disease / Vector Surveillance

Questions:

* Can GBIF-mediated occurrence data support vector distribution mapping?
* Are records recent enough?
* Are human-disease-linked taxa represented?

## 14. Key Product Principle

The tool must always separate:

```text
Data availability
```

from

```text
Data suitability
```

and from

```text
Scientific claim strength
```

A high number of records does not automatically mean the data can support a strong scientific conclusion.

## 15. Primary User Flow

### Step 1: User Enters Research Question

Input box:

```text
What do you want to study using GBIF-mediated data?
```

Example:

```text
I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.
```

Optional structured fields:

* Taxon or taxonomic group.
* Region.
* Time range.
* Intended analysis.
* Spatial scale.
* Desired output.
* User experience level.

### Step 2: System Parses Research Intent

System extracts:

* Target taxon.
* Taxonomic rank.
* Region.
* Time period.
* Intended analysis type.
* Required data type.
* Likely GBIF query filters.
* Potential ambiguity.

Example parsed result:

```json
{
  "taxon": "kingfishers",
  "likely_taxon_key": "Alcedinidae",
  "region": "Southeast Asia",
  "time_range": "1990-2025",
  "analysis_type": "range_shift_distribution",
  "required_data_type": "georeferenced_occurrence_records",
  "claim_strength_requested": "climate-driven temporal change"
}
```

### Step 3: User Confirms or Adjusts Interpretation

Show a confirmation screen:

```text
We interpreted your question as:

Taxon: Kingfishers / Alcedinidae
Region: Southeast Asia
Years: 1990–2025
Likely analysis: range-shift / distribution analysis
Data needed: georeferenced occurrence records with dates
```

User can edit:

* Taxon.
* Region.
* Time range.
* Analysis type.
* Spatial resolution.

### Step 4: Data Availability Preview

System queries GBIF APIs / occurrence cube summaries.

Show:

* Estimated record count.
* Number with coordinates.
* Number with eventDate.
* Number with both coordinates and date.
* Records by year/decade.
* Records by country.
* Records by basisOfRecord.
* Records by dataset.
* Species/taxon coverage.
* Coordinate uncertainty distribution where available.
* Issue/flag summary.
* Sampling-event datasets if relevant.

### Step 5: Data-Type Triage

The tool asks:

> “What kind of data does this research question actually require?”

Output examples:

For SDM:

```text
Occurrence-only data may be sufficient for exploratory species distribution modelling, provided spatial bias and coordinate quality are addressed.
```

For abundance trend:

```text
Ordinary occurrence records are not enough for robust abundance-trend inference. Look for sampling-event datasets, monitoring schemes, effort metadata, abundance counts, or repeated standardized surveys.
```

### Step 6: Bias and Limitation Analysis

Generate a structured report.

Bias categories:

* Spatial bias.
* Temporal bias.
* Taxonomic bias.
* Dataset-source bias.
* Country/region imbalance.
* Coordinate uncertainty.
* Basis-of-record imbalance.
* Citizen-science dominance.
* Museum/specimen historical bias.
* Protected-area bias.
* Urban/accessibility bias.
* Seasonal bias.
* Duplicate-risk warning.
* Coarse-grid warning.
* Sampling-event absence warning.

### Step 7: Research Support Classification

Do **not** use one final score as the main output.

Use categories:

```text
Strongly supported
Conditionally supported
Weakly supported
Not supported by current GBIF occurrence data
```

Example:

```text
Strongly supported:
- Exploratory occurrence mapping
- Checklist-style data overview

Conditionally supported:
- Species distribution modelling
- Range-shift exploration

Weakly supported:
- Climate-driven causal inference

Not supported by occurrence-only data:
- Population abundance trend estimation
```

### Step 8: Recommended Workflow

Generate:

* GBIF query filters.
* GBIF.org search URL.
* rgbif download code.
* Python/pygbif code if feasible.
* SQL/cube query if useful.
* Cleaning steps.
* Bias checks.
* Visualization steps.
* Citation instructions.
* Suggested methods paragraph.
* Limitations paragraph.

### Step 9: Export Package

User can download a zip containing:

```text
study_plan.md
data_availability_summary.json
gbif_query.json
gbif_download.R
gbif_download.py
cleaning_pipeline.R
bias_checks.R
README.md
methods_text.md
limitations_text.md
citation_instructions.md
report.html
```

## 16. MVP Output Example

Input:

```text
I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.
```

Output:

```text
GBIF Workbench Report

Interpreted Study
Taxon: Kingfishers / Alcedinidae
Region: Southeast Asia
Years: 1990–2025
Intended analysis: range-shift / distribution analysis

Data Needed
Primary: georeferenced occurrence records with event dates
Recommended extras: environmental predictors, spatial bias correction, taxonomic verification

GBIF Data Availability
Records found: [computed]
Records with coordinates: [computed]
Records with dates: [computed]
Records with both: [computed]
Strongest countries: [computed]
Weakest countries: [computed]
Main datasets: [computed]

Research Support
Strongly supported:
- Exploratory mapping
- Occurrence summary
- Data availability assessment

Conditionally supported:
- Species distribution modelling
- Preliminary range-shift analysis

Weakly supported:
- Climate-driven causal inference

Not supported without additional data:
- Abundance trend inference

Major Risks
1. Temporal imbalance: most records after [computed year].
2. Geographic imbalance: records concentrated in [computed countries/areas].
3. Sampling bias: possible urban/accessibility bias.
4. Taxonomic ambiguity: some records not resolved to species level.

Recommended GBIF Filters
- hasCoordinate = true
- hasGeospatialIssue = false
- year = 1990,2025
- taxonKey = [computed]
- country IN [computed]
- basisOfRecord: consider excluding fossil/material samples depending on study

Recommended Preprocessing
1. Resolve names against GBIF Backbone.
2. Exclude records with major geospatial issues.
3. Remove or flag records with high coordinate uncertainty.
4. Remove duplicate coordinates per species/date/dataset where appropriate.
5. Apply spatial thinning or sampling-bias correction before SDM.
6. Split data into time periods only if record volume is sufficient in each period.
7. Avoid causal climate-change claims without additional modelling and bias controls.

Generated Files
- gbif_download.R
- gbif_download.py
- cleaning_pipeline.R
- study_plan.md
- methods_text.md
- limitations_text.md
```

## 17. UX Requirements

### 17.1 Landing Page

Must immediately explain:

```text
Plan your GBIF study before you download data.
```

Include 3 sample prompts:

* “Can I study range shifts of kingfishers in Southeast Asia?”
* “Can GBIF show whether frogs are declining in Bangladesh?”
* “Can I model the distribution of lions in Africa?”

CTA:

```text
Start a study plan
```

### 17.2 Study Input Screen

Components:

* Large natural-language input.
* Optional advanced fields.
* Example prompts.
* “Analyze study idea” button.

Advanced fields:

* Taxon.
* Region.
* Years.
* Intended analysis.
* Spatial resolution.
* User skill level.
* Preferred code language: R / Python / Both.

### 17.3 Interpretation Screen

Show parsed interpretation.

User can edit before running expensive API calls.

Important because natural-language parsing may be wrong.

### 17.4 Data Preview Screen

Sections:

1. Record counts.
2. Map preview.
3. Time histogram.
4. Country/region distribution.
5. Dataset contribution.
6. Taxonomic breakdown.
7. Basis of record.
8. Issues/flags summary.
9. Sampling-event availability.

### 17.5 Triage Screen

Clear answer:

```text
Can GBIF support this study?
```

Use nuanced labels:

* Good starting point.
* Usable with caveats.
* Exploratory only.
* Needs different data type.
* Not enough data.

Avoid “yes/no” simplification.

### 17.6 Bias Screen

Show risk cards:

```text
Spatial bias: High
Temporal bias: Moderate
Taxonomic resolution risk: Low
Data-type mismatch: High
```

Each card must have:

* Plain-language explanation.
* Evidence.
* Why it matters.
* Suggested mitigation.
* Relevant generated code step.

### 17.7 Workflow Screen

Show generated:

* GBIF filters.
* Query preview.
* R code.
* Python code.
* Cleaning steps.
* Methods text.
* Limitations text.

### 17.8 Export Screen

Export options:

* HTML report.
* Markdown report.
* JSON plan.
* R notebook.
* Python notebook.
* Zip package.

## 18. UI Tone

Use cautious scientific language.

Good language:

* “appears suitable for exploratory use”
* “conditionally usable”
* “requires additional data”
* “major caveat”
* “not enough evidence”
* “this does not support abundance inference”
* “recommended next step”

Bad language:

* “definitely valid”
* “scientifically proven”
* “ready for SDM”
* “good dataset”
* “bad dataset”
* “AI-approved”
* “publishable result”

## 19. Technical Architecture

### 19.1 Suggested Stack

Frontend:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* MapLibre or Leaflet for maps
* Recharts / Observable Plot / Vega-Lite for charts

Backend:

* Python FastAPI or Node.js/NestJS
* Python preferred for biodiversity/statistical tooling
* Background jobs with Celery/RQ/Temporal if using Python
* PostgreSQL for saved study plans
* Redis for job status/cache
* Object storage for generated reports

Analysis layer:

* Python for API orchestration and report generation
* R scripts or containerized R for CoordinateCleaner/sampbias/occAssess integration
* Jupyter/Quarto for generated notebooks
* Optional: DuckDB for local summaries

AI layer:

* LLM used only for:

  * Research question parsing.
  * Plain-language explanations.
  * Methods/limitations text drafting.
  * Mapping user intent to structured study types.
* Rule-based/scoring layer used for:

  * Data-type triage.
  * Risk classification.
  * Query generation.
  * Reproducible outputs.

### 19.2 High-Level Architecture

```text
Frontend
  ↓
Study Planner API
  ↓
Intent Parser
  ↓
GBIF Query Builder
  ↓
GBIF Data Preview Service
  ↓
Bias/Risk Engine
  ↓
Workflow Generator
  ↓
Report Exporter
```

### 19.3 Services

#### Intent Parser Service

Input:

```json
{
  "question": "I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025"
}
```

Output:

```json
{
  "taxon_text": "kingfishers",
  "region_text": "Southeast Asia",
  "start_year": 1990,
  "end_year": 2025,
  "analysis_type": "range_shift_distribution",
  "claim_type": "climate_driven_change",
  "required_data": ["occurrence", "coordinates", "eventDate"],
  "possible_required_extra_data": ["environmental_predictors"]
}
```

#### Taxon Resolver Service

Responsibilities:

* Resolve user taxon to GBIF taxonKey.
* Show ambiguous matches.
* Prefer accepted names.
* Show taxonomic rank.
* Store confidence.

#### Region Resolver Service

Responsibilities:

* Convert region text to country list or polygon.
* Support country names first.
* For MVP, avoid complex custom polygons unless easy.
* Southeast Asia should map to a configurable country list.
* Allow user correction.

#### GBIF Preview Service

Responsibilities:

* Query counts and summaries.
* Use GBIF APIs and occurrence cubes where appropriate.
* Avoid full downloads for preview.
* Cache repeated previews.
* Return structured summaries.

#### Data-Type Triage Engine

Responsibilities:

Classify whether the study requires:

* Occurrence records.
* Sampling-event data.
* Absence data.
* Abundance data.
* Sampling effort.
* Repeated monitoring.
* Multimedia.
* Taxonomic checklist.
* Environmental variables outside GBIF.

#### Bias/Risk Engine

Responsibilities:

* Summarize GBIF issues and flags.
* Detect spatial/temporal imbalance.
* Estimate country imbalance.
* Identify basis-of-record skew.
* Identify temporal clustering.
* Flag data-type mismatch.
* Suggest mitigation.

#### Workflow Generator

Responsibilities:

Generate:

* GBIF.org search URL.
* rgbif code.
* Python/pygbif code.
* SQL/cube query if relevant.
* Cleaning workflow.
* Methods text.
* Limitations text.
* Citation instructions.

#### Report Generator

Responsibilities:

* Render HTML report.
* Render Markdown report.
* Render downloadable zip.
* Include all parameters and assumptions.

## 20. Data Sources and APIs

### Required GBIF Data Sources

Use GBIF services for:

* Species/taxon matching.
* Occurrence search/counts.
* Occurrence downloads.
* Occurrence issues/flags.
* Dataset metadata.
* Occurrence cubes / SQL summaries where applicable.
* Citation/download DOI instructions.

### Useful External/Open Tools

Potential integrations:

* CoordinateCleaner for geospatial and temporal cleaning workflows.
* sampbias for accessibility-related sampling bias estimation.
* occAssess for screening occurrence data for bias.
* rgbif for R workflow generation.
* pygbif for Python workflow generation.

Important: In MVP, it is acceptable to generate code that uses these tools rather than fully running every analysis server-side.

## 21. Rules Engine

The rules engine is the product’s scientific backbone.

### 21.1 Analysis Types

MVP analysis types:

```text
distribution_mapping
species_distribution_modelling
range_shift_exploration
temporal_trend_or_abundance
invasive_monitoring_preview
unknown
```

### 21.2 Data-Type Requirements

#### Distribution Mapping

Requires:

* Taxon.
* Coordinates.
* Region.
* Optional eventDate.

Can use occurrence-only data.

#### Species Distribution Modelling

Requires:

* Coordinates.
* Taxon resolved preferably to species.
* Enough records after filtering.
* Environmental predictors outside GBIF.
* Spatial bias mitigation.
* Coordinate uncertainty assessment.
* Temporal relevance depending on predictors.

Can use presence-only data for some methods, but with caveats.

#### Range-Shift Exploration

Requires:

* Coordinates.
* Event dates.
* Sufficient records in multiple time periods.
* Comparable sampling effort or strong bias controls.
* Environmental/context data if climate claims are made.

Occurrence data may support exploratory analysis but not strong causal claims alone.

#### Temporal Trend / Abundance

Requires:

* Sampling effort.
* Repeated surveys.
* Absence or abundance data.
* Standardized protocols.
* Sampling-event data.

Occurrence-only records are usually not sufficient for robust abundance/population trend claims.

### 21.3 Risk Levels

Use risk labels:

```text
LOW
MODERATE
HIGH
BLOCKING
UNKNOWN
```

### 21.4 Support Labels

Use:

```text
STRONGLY_SUPPORTED
CONDITIONALLY_SUPPORTED
EXPLORATORY_ONLY
NOT_SUPPORTED_WITH_OCCURRENCE_ONLY
INSUFFICIENT_DATA
```

### 21.5 Do Not Use a Single Main Score

A score can be shown as secondary, but the primary output must be categorical and explanatory.

If a score is used, it must be per dimension:

```text
Spatial readiness: 72/100
Temporal readiness: 48/100
Taxonomic readiness: 83/100
Data-type match: 40/100
```

Never use only:

```text
Overall readiness: 82/100
```

because it invites overinterpretation.

## 22. Example Rule Logic

### 22.1 Occurrence-Only Mismatch Rule

If analysis type is:

```text
temporal_trend_or_abundance
```

and no sampling-event/effort/abundance data is found, output:

```text
Not supported by ordinary occurrence-only data. GBIF occurrence records may show reporting patterns but cannot alone support robust population abundance or decline inference.
```

### 22.2 Coordinate Requirement Rule

If analysis type requires mapping/modelling and records with coordinates are low:

```text
Risk: BLOCKING
Reason: Too few georeferenced records after filtering.
```

### 22.3 Temporal Coverage Rule

If range-shift analysis and records are concentrated in one recent period:

```text
Risk: HIGH
Reason: Temporal imbalance may reflect changing data mobilization or citizen-science activity, not biological range shift.
```

### 22.4 Basis-of-Record Rule

If a high percentage of records are preserved specimens:

```text
Risk: MODERATE
Reason: Museum/specimen records may be historically valuable but may not represent current distribution.
```

If a high percentage are human observations:

```text
Risk: MODERATE
Reason: Citizen-science observations may be spatially and temporally biased toward accessible areas and popular taxa.
```

### 22.5 Taxonomic Resolution Rule

If many records are genus-level but user asked species-level modelling:

```text
Risk: HIGH
Reason: Species-level modelling requires species-level identification. Genus-level records may not be appropriate unless the study is intentionally genus-level.
```

### 22.6 Coordinate Uncertainty Rule

If many records have high coordinate uncertainty:

```text
Risk: HIGH
Reason: Coordinate uncertainty may exceed the spatial resolution of the intended analysis.
```

### 22.7 Spatial Resolution Rule

If user wants fine-scale analysis but coordinates are coarse:

```text
Risk: HIGH
Reason: The coordinate precision appears too low for the requested spatial scale.
```

## 23. AI Usage Requirements

### 23.1 Allowed AI Uses

AI may be used for:

* Parsing the user’s research question.
* Asking clarifying questions.
* Explaining technical results in plain language.
* Drafting methods text.
* Drafting limitations text.
* Summarizing rule-engine outputs.
* Suggesting workflow sections.

### 23.2 Forbidden AI Uses

AI must **not** be the sole authority for:

* Taxonomic resolution.
* Record counts.
* Occurrence summaries.
* Data suitability classification.
* Risk labels.
* Citation generation.
* GBIF query construction.
* Scientific claims.

These must come from deterministic code, GBIF APIs, and documented rules.

### 23.3 AI Output Guardrails

Every AI-generated explanation must be grounded in structured findings.

Bad:

```text
The data looks good for modelling.
```

Good:

```text
The data may be usable for exploratory species distribution modelling because there are enough georeferenced records after filtering, but the result should be treated cautiously due to strong temporal clustering after 2015.
```

## 24. Prompting Strategy

Use the LLM in a constrained way.

### 24.1 Intent Parser Prompt

System instruction:

```text
You extract structured biodiversity research intent from the user's question.
Return only JSON matching the schema.
Do not invent record counts.
Do not invent GBIF results.
If uncertain, mark fields as null and include ambiguity.
```

### 24.2 Explanation Prompt

System instruction:

```text
You explain structured GBIF Workbench findings in plain language.
You must not add unsupported claims.
You must not say data is definitively suitable.
Use cautious language.
Always distinguish exploratory use from strong inference.
```

### 24.3 Methods Text Prompt

System instruction:

```text
Draft a methods paragraph using only the provided query parameters, filters, cleaning steps, and citation metadata.
Do not invent methods not included in the workflow.
```

## 25. Generated Code Requirements

### 25.1 R Workflow

Must include:

* `rgbif`
* `dplyr`
* `readr`
* Optional `CoordinateCleaner`
* Optional `sf`
* Optional `ggplot2`
* Optional `terra`

Generate `occ_download()` for serious data use, not only `occ_search()`.

Example structure:

```r
library(rgbif)
library(dplyr)
library(readr)

# 1. Resolve taxon
# 2. Create GBIF download predicate
# 3. Request occurrence download
# 4. Import download
# 5. Apply filters
# 6. Summarize issues
# 7. Export cleaned data
```

### 25.2 Python Workflow

Potential libraries:

* pygbif
* pandas
* geopandas
* shapely
* matplotlib/plotly
* requests

Python support can be secondary if R implementation is stronger.

### 25.3 Notebook Outputs

Generate:

* RMarkdown or Quarto preferred.
* Jupyter notebook optional.
* Markdown fallback required.

### 25.4 Reproducibility Requirements

Every generated workflow must include:

* Date generated.
* Query parameters.
* Taxon key.
* Region definition.
* Year range.
* Filters.
* Cleaning assumptions.
* Limitations.
* Citation instructions.

## 26. Report Requirements

### 26.1 Report Sections

Each generated report must contain:

1. Title.
2. User research question.
3. Interpreted study scope.
4. Taxon resolution.
5. Region resolution.
6. Data needed for intended claim.
7. GBIF data availability preview.
8. Data-type triage.
9. Bias and limitation assessment.
10. Supported/unsupported claims.
11. Recommended filters.
12. Recommended workflow.
13. Generated code links.
14. Citation instructions.
15. Limitations and assumptions.
16. “What to do next” section.

### 26.2 Report Tone

Must be practical, not academic-only.

The report should help the user decide:

```text
Should I proceed?
Should I modify my research question?
Should I seek another data type?
Should I use GBIF only for exploratory analysis?
```

## 27. Data Availability Metrics

Minimum metrics:

* Total matching records.
* Records with coordinates.
* Records with event date/year.
* Records with both coordinates and date.
* Records by year/decade.
* Records by country.
* Records by basisOfRecord.
* Records by dataset.
* Taxonomic breakdown.
* Records with key GBIF issues.
* Records with coordinate uncertainty, where available.
* Sampling-event dataset count, where relevant.

Advanced metrics:

* Number of records per grid cell.
* Temporal coverage per country.
* Dataset concentration index.
* Top contributor dominance.
* Pre/post-period balance for range-shift questions.
* Species-level completeness for taxon-group questions.

## 28. Bias/Risk Metrics

### 28.1 Spatial Bias

Detect:

* Clustering in cities.
* Clustering near roads/rivers if data available.
* Protected-area concentration if layers available.
* Country imbalance.
* Empty regions inside requested scope.
* Coarse-grid patterns.
* Centroid-like coordinates.

### 28.2 Temporal Bias

Detect:

* Records heavily concentrated after a certain year.
* Records heavily concentrated in historical museum periods.
* Missing years/decades.
* Uneven periods for before/after comparisons.
* Seasonal clustering.

### 28.3 Taxonomic Bias

Detect:

* Many records above species level.
* Synonym/accepted-name mismatch.
* Unresolved names.
* Taxonomic group imbalance.
* Charismatic species dominance if taxon group query.

### 28.4 Source Bias

Detect:

* Single dataset dominates results.
* Single publisher dominates.
* Citizen-science dominance.
* Museum/specimen dominance.
* Machine observation/media dominance if relevant.

### 28.5 Data-Type Risk

Detect:

* User asks trend/abundance but only occurrence data is available.
* User asks fine-scale mapping but coordinate uncertainty is high.
* User asks current distribution but many records are old.
* User asks climate-change causality but only occurrence records are available.

## 29. Technical Feasibility Plan

### Phase 1: Working Prototype

Build:

* Natural-language input.
* Intent parsing.
* Taxon resolution.
* Region resolution for countries and simple regions.
* GBIF occurrence summary.
* Basic triage rules.
* HTML/Markdown report.
* R code generation.

Do not build:

* Full sampbias server execution.
* Full SDM.
* Complex custom polygons.
* User accounts.
* Multi-project dashboard.

### Phase 2: Better Bias Diagnostics

Add:

* CoordinateCleaner integration.
* occAssess-inspired summaries.
* Optional sampbias integration.
* Map visualizations.
* Dataset concentration metrics.
* Temporal imbalance metrics.

### Phase 3: Export and Challenge Polish

Add:

* Downloadable zip.
* Demo examples.
* Documentation.
* Hosted prototype.
* GitHub repo.
* Demo video.
* Test datasets.
* Reproducibility instructions.

## 30. Challenge Demo Strategy

The demo must be understandable in 30–90 seconds.

### Demo Scenario 1: Range Shift

Input:

```text
I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.
```

Show:

* Interpreted scope.
* Data availability.
* Bias risks.
* “Conditionally supported, not causal alone.”
* Generated rgbif workflow.

### Demo Scenario 2: Abundance Decline

Input:

```text
Are frog populations declining in Bangladesh since 2000?
```

Show:

* Tool warns that occurrence-only data is not enough.
* Recommends sampling-event/monitoring datasets.
* Shows what GBIF can still support: exploratory occurrence mapping.
* Generates safer alternative workflow.

This second demo is crucial because it proves GBIF Workbench is not blindly helping users misuse data.

## 31. Acceptance Criteria

### 31.1 Functional Acceptance Criteria

The system must:

* Accept a natural-language research question.
* Extract taxon, region, time range, and intended analysis.
* Let user correct parsed fields.
* Resolve taxon through GBIF.
* Generate GBIF query parameters.
* Preview occurrence data availability.
* Classify data-type fit.
* Produce bias/limitation report.
* Generate recommended GBIF filters.
* Generate R workflow.
* Export Markdown/HTML report.
* Use cautious, scientifically defensible language.

### 31.2 Non-Functional Acceptance Criteria

The system must:

* Be open source.
* Be documented.
* Be runnable by judges.
* Work without paid services for core functionality.
* Cache GBIF API responses.
* Avoid unnecessary full data downloads during preview.
* Be transparent about limitations.
* Keep rule logic visible in repo.
* Include example outputs.
* Include tests for rule engine.

### 31.3 Scientific Acceptance Criteria

The system must:

* Never claim universal suitability.
* Separate data availability from data suitability.
* Separate exploratory use from strong inference.
* Warn when occurrence-only data is insufficient.
* Explain evidence behind each risk.
* Preserve provenance of generated recommendations.

## 32. Repository Structure

Suggested:

```text
gbif-workbench/
  README.md
  LICENSE
  docs/
    product_overview.md
    scientific_guardrails.md
    rule_engine.md
    api_setup.md
    demo_script.md
  apps/
    web/
      package.json
      src/
    api/
      pyproject.toml
      app/
  packages/
    rules/
    gbif_client/
    report_generator/
    workflow_generator/
  examples/
    kingfishers_se_asia/
    frogs_bangladesh/
    panthera_leo_africa/
  notebooks/
    generated_examples/
  tests/
    test_intent_parser.py
    test_rule_engine.py
    test_query_builder.py
```

## 33. API Design

### 33.1 POST /api/parse-intent

Input:

```json
{
  "question": "I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025"
}
```

Output:

```json
{
  "taxon_text": "kingfishers",
  "region_text": "Southeast Asia",
  "start_year": 1990,
  "end_year": 2025,
  "analysis_type": "range_shift_distribution",
  "confidence": 0.82,
  "ambiguities": []
}
```

### 33.2 POST /api/resolve-taxon

Input:

```json
{
  "taxon_text": "kingfishers"
}
```

Output:

```json
{
  "matches": [
    {
      "scientificName": "Alcedinidae",
      "rank": "FAMILY",
      "taxonKey": 2984,
      "confidence": 91
    }
  ]
}
```

### 33.3 POST /api/preview

Input:

```json
{
  "taxonKey": 2984,
  "countries": ["TH", "MY", "ID", "VN", "PH"],
  "startYear": 1990,
  "endYear": 2025,
  "analysisType": "range_shift_distribution"
}
```

Output:

```json
{
  "recordCounts": {},
  "temporalSummary": {},
  "countrySummary": {},
  "basisOfRecordSummary": {},
  "datasetSummary": {},
  "issuesSummary": {},
  "samplingEventSummary": {}
}
```

### 33.4 POST /api/triage

Input:

```json
{
  "studyIntent": {},
  "dataPreview": {}
}
```

Output:

```json
{
  "supportClassification": {},
  "risks": [],
  "recommendedFilters": [],
  "unsupportedClaims": [],
  "nextSteps": []
}
```

### 33.5 POST /api/generate-workflow

Input:

```json
{
  "studyIntent": {},
  "query": {},
  "triage": {}
}
```

Output:

```json
{
  "rCode": "...",
  "pythonCode": "...",
  "methodsText": "...",
  "limitationsText": "...",
  "citationInstructions": "..."
}
```

### 33.6 POST /api/export-report

Input:

```json
{
  "studyIntent": {},
  "dataPreview": {},
  "triage": {},
  "workflow": {}
}
```

Output:

```json
{
  "htmlUrl": "...",
  "markdownUrl": "...",
  "zipUrl": "..."
}
```

## 34. Data Model

### StudyPlan

```json
{
  "id": "uuid",
  "createdAt": "datetime",
  "question": "string",
  "taxonText": "string",
  "taxonKey": "number",
  "scientificName": "string",
  "regionText": "string",
  "countries": ["string"],
  "geometry": "geojson|null",
  "startYear": "number|null",
  "endYear": "number|null",
  "analysisType": "string",
  "claimType": "string",
  "preferredLanguage": "R|Python|Both",
  "status": "draft|previewed|triaged|exported"
}
```

### Risk

```json
{
  "category": "spatial|temporal|taxonomic|source|data_type|citation|other",
  "level": "LOW|MODERATE|HIGH|BLOCKING|UNKNOWN",
  "title": "string",
  "evidence": "string",
  "whyItMatters": "string",
  "recommendedMitigation": "string",
  "relatedWorkflowStep": "string|null"
}
```

### SupportClassification

```json
{
  "stronglySupported": ["string"],
  "conditionallySupported": ["string"],
  "exploratoryOnly": ["string"],
  "notSupportedWithOccurrenceOnly": ["string"],
  "insufficientData": ["string"]
}
```

## 35. Security and Privacy

MVP should avoid collecting sensitive user data.

* No login required for demo.
* Optional local/session storage.
* Do not store user questions permanently unless user opts in.
* If using LLM APIs, clearly document what text is sent.
* Do not send GBIF credentials to LLM.
* For generated downloads requiring GBIF credentials, instruct user to run locally.

## 36. Performance Requirements

* Intent parsing: under 5 seconds.
* Taxon resolution: under 5 seconds.
* Data preview: under 30 seconds for normal queries.
* Report generation: under 15 seconds after preview.
* Long-running analysis jobs should show progress.

Use caching for:

* Taxon matches.
* Country/region mappings.
* Common sample queries.
* Preview summaries.

## 37. Error Handling

### Taxon Ambiguity

If taxon has multiple matches:

```text
We found multiple possible taxa. Please choose one.
```

### Region Ambiguity

If region is vague:

```text
“Southeast Asia” can be defined in different ways. We used this country list. You can edit it.
```

### Too Many Records

If preview query is huge:

```text
This query may be large. We are using aggregated summaries first. Full download should be done through GBIF asynchronous download.
```

### Too Few Records

If insufficient data:

```text
GBIF currently appears to have too few matching records for this proposed analysis. You may need to broaden the taxon, region, or time range, or use additional data sources.
```

### API Failure

If GBIF API fails:

```text
GBIF preview failed. Try again or simplify the query. No scientific conclusion has been generated.
```

## 38. Do’s

Do:

* Start before data download.
* Use GBIF APIs and official identifiers.
* Generate reproducible workflows.
* Use cautious language.
* Make assumptions visible.
* Let users edit parsed scope.
* Use occurrence cubes/summaries where helpful.
* Warn when sampling-event data is needed.
* Treat bias as a research-design issue, not only a data-cleaning issue.
* Include limitations text in every report.
* Make rule logic open-source.
* Include demo examples.
* Make the UI simple enough for non-programmers.
* Make outputs useful enough for programmers.

## 39. Don’ts

Do not:

* Claim a dataset is universally suitable.
* Use a single magic “readiness score” as the main result.
* Pretend occurrence-only data supports abundance trends.
* Build a generic chatbot.
* Build only a visualization dashboard.
* Build only a GBIF search wrapper.
* Build only a CoordinateCleaner/sampbias/occAssess wrapper.
* Hide assumptions.
* Generate citations without using GBIF download DOI guidance.
* Encourage serious research using only quick occurrence search calls.
* Overpromise scientific validity.
* Ignore taxonomic ambiguity.
* Ignore geographic ambiguity.
* Ignore temporal imbalance.
* Ignore basisOfRecord.
* Ignore sampling-event data.
* Send users straight to modelling without warnings.

## 40. Similar / Overlapping Tools to Know

### GBIF Occurrence Cubes

These already provide aggregated summaries across taxonomic, temporal, and spatial dimensions.

GBIF Workbench should use them, not compete with them.

### CoordinateCleaner

Useful for identifying common spatial/temporal errors in occurrence data.

GBIF Workbench can generate CoordinateCleaner-based cleaning workflows.

### sampbias

Useful for estimating accessibility-related geographic sampling bias.

GBIF Workbench can reference or optionally integrate it.

### occAssess

Useful for screening species occurrence data for common biases.

GBIF Workbench can use similar concepts or generate occAssess workflow suggestions.

### rgbif

R package for GBIF API/download workflows.

GBIF Workbench should generate rgbif code, especially serious downloads through `occ_download()`.

### pygbif

Python package for GBIF workflows.

Useful for Python users, but R workflow may be stronger for biodiversity audiences.

### BDQEmail

Existing winner focused on biodiversity data quality checks.

GBIF Workbench must not duplicate this.

### ChatIPT

Existing winner focused on data publishing.

GBIF Workbench must target data use/planning, not publishing.

### BAM

Existing winner focused on embedded local biodiversity exploration.

GBIF Workbench must target research planning and reproducibility.

## 41. Scientific Guardrails

Every report must include a disclaimer-like section:

```text
This report does not certify that the data are scientifically valid. It summarizes GBIF-mediated data availability and common data-use risks for the research question provided. Final suitability depends on the user's methods, assumptions, taxon expertise, spatial/temporal scale, and additional data sources.
```

Avoid legalistic language, but make the scientific limitation clear.

## 42. MVP Build Plan

### Week 1: Foundation

* Define schemas.
* Implement frontend input flow.
* Implement intent parser.
* Implement taxon resolver.
* Implement region resolver for countries/common regions.
* Create static report template.

### Week 2: GBIF Preview

* Implement occurrence count summaries.
* Implement year/country/basisOfRecord summaries.
* Implement issues/flags summary.
* Implement dataset contribution summary.
* Add caching.

### Week 3: Triage Rules

* Implement analysis-type classification.
* Implement data-type mismatch rules.
* Implement spatial/temporal/taxonomic/source risk rules.
* Implement support classification output.

### Week 4: Workflow Generation

* Generate rgbif code.
* Generate basic Python code.
* Generate cleaning steps.
* Generate methods and limitations text.
* Generate Markdown/HTML report.

### Week 5: Demo Polish

* Add visualizations.
* Add example studies.
* Add export zip.
* Add README and docs.
* Add deployment.
* Record demo video.

## 43. Judging Strategy

The submission should emphasize:

### Applicability

Many GBIF data users can use it before starting a study.

### Benefit to GBIF Network

It improves responsible reuse of GBIF-mediated data, reduces misuse, increases citation/reproducibility, and helps users understand when additional data types are needed.

### Innovation

It is not merely data cleaning or search. It is a pre-download research triage layer.

### Quality

It uses structured rules, official GBIF APIs, reproducible workflows, and transparent assumptions.

### Openness

Open-source code, open rules, generated notebooks, and example reports.

### Repeatability

Every recommendation should map back to query parameters, data summaries, rules, and generated code.

## 44. Submission Materials Needed

For Ebbe Nielsen Challenge submission, prepare:

* Project title: GBIF Workbench.
* Abstract.
* Rationale.
* Operating instructions.
* Hosted demo link.
* GitHub repository.
* Demo video.
* Example reports.
* Installation instructions.
* License.
* Technical architecture document.
* Scientific guardrails document.
* Demo datasets / demo queries.
* README explaining how judges can run it.

## 45. Suggested Abstract

GBIF Workbench is a bias-aware research triage tool that helps users decide whether, when, and how GBIF-mediated data can support a proposed biodiversity study before they download data. Users enter a natural-language research question, and GBIF Workbench interprets the taxonomic, geographic, temporal, and analytical scope; previews relevant GBIF data availability; identifies likely limitations and biases; warns when ordinary occurrence records are insufficient; and generates a reproducible GBIF workflow with query filters, code, methods text, limitations, and citation guidance. Rather than assigning a universal data-quality score, GBIF Workbench translates GBIF data availability and quality signals into cautious, use-case-specific research planning guidance. The tool supports responsible reuse of GBIF-mediated data, improves reproducibility, and helps researchers avoid common data-use mistakes.

## 46. Suggested Demo Script

### Opening

“GBIF has enormous biodiversity data, but researchers often struggle before they even download: Can this data support my question? What filters should I use? Am I about to misuse occurrence records? GBIF Workbench answers those questions before download.”

### Demo 1

Enter:

```text
I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025.
```

Show:

* Scope parsing.
* Taxon resolution.
* Data preview.
* Bias warnings.
* Conditional support.
* Generated rgbif workflow.

### Demo 2

Enter:

```text
Are frog populations declining in Bangladesh since 2000?
```

Show:

* Data-type mismatch warning.
* Occurrence-only limitation.
* Recommendation to seek sampling-event/monitoring data.
* Safer exploratory workflow.

### Closing

“GBIF Workbench does not replace expert judgment. It makes assumptions visible, prevents common misuse, and turns GBIF data discovery into a reproducible research plan.”

## 47. Final Product Definition

GBIF Workbench is not a chatbot, not a bias dashboard, not a data cleaner, and not a modelling platform.

It is:

```text
Research question
↓
GBIF data-use triage
↓
Bias-aware limitations
↓
Correct data-type guidance
↓
Reproducible workflow
```

The core promise:

> Help users avoid bad GBIF data use and start good GBIF data use.

That is the product.
