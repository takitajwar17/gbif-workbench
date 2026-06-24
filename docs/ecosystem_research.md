# Ecosystem and Challenge Research

Date: 2026-06-18

## Verdict

GBIF Workbench is on the right track for the 2026 Ebbe Nielsen Challenge if it stays tightly positioned as pre-download research-design triage for GBIF-mediated data.

The strongest version is not "ChatGPT for GBIF" and not another post-download data-cleaning package. The winning wedge is:

> A transparent, repeatable tool that turns a biodiversity research question into a defensible GBIF data-use plan before the user downloads data.

That positioning matches the original `IDEA.md` and is stronger than a generic chatbot, a static dashboard, or a hardcoded demo. The app version is also better than the PRD where it adds editable scope interpretation, live GBIF facets, explicit unsupported-claim handling, notebook exports, and a SQL/cube starter workflow.

## Research Rounds

| Round | Source | Signal | Product implication |
| --- | --- | --- | --- |
| 1 | [2026 Ebbe Nielsen Challenge](https://www.gbif.org/news/3DyM3tK5wgYipqyaHwG2c2/2026-ebbe-nielsen-challenge-open-for-submissions) | The challenge asks for tools, workflows, analyses, and prototypes that leverage GBIF data for open science. | GBIF Workbench should be framed as a workflow-generating research tool, not a content site. |
| 2 | [2026 Challenge criteria](https://www.gbif.org/news/3DyM3tK5wgYipqyaHwG2c2/2026-ebbe-nielsen-challenge-open-for-submissions) | Judging emphasizes relevance, novelty, quality, openness, repeatability, and practical operation at no cost to users. | Keep exports, source code, API instructions, and no-login preview central. |
| 3 | [2025 winners](https://www.gbif.org/news/2LugQxJfG2kCzjiJocXzVZ/winners-from-norway-and-australia-share-first-place-in-the-2025-ebbe-nielsen-challenge) | BDQEmail reduced biodiversity data-quality friction; galaxias made Darwin Core Archive publishing easier; BAM turned GBIF data into an embeddable local widget. | Winners solve concrete GBIF workflow pain, so GBIF Workbench must produce immediate practical output. |
| 4 | [2024 winner ChatIPT](https://www.gbif.org/news/6aw2VFiEHYlqb48w86uKSf/chatipt-system-wins-the-2024-ebbe-nielsen-challenge) | ChatIPT uses LLMs to help non-technical users transform messy data for GBIF publication. | AI is acceptable when constrained to practical, standards-aware workflow assistance. |
| 5 | [2023 winner GBIF Alert](https://www.gbif.org/news/EQgUzZ4YA75BSeLs1naI9/belgian-built-gbif-alert-system-wins-the-2023-ebbe-nielsen-challenge) | GBIF Alert won by being reusable, open source, configurable, and useful for real monitoring needs. | GBIF Workbench should avoid hardcoded examples and generate reusable plans from live inputs. |
| 6 | [2022 winners GridDER and bdc](https://www.gbif.org/news/6J94JrRZtDCPhUZMMiTALq/gridder-and-bdc-share-top-honors-in-2022-gbif-ebbe-nielsen-challenge) | Winners focused on data fitness-for-use, spatial uncertainty, and cleaning workflows. | GBIF Workbench should complement these tools by recommending cleaning and uncertainty checks before analysis. |
| 7 | [2021 winner Bio-Dem](https://www.gbif.org/news/QWLleXqOFkDOGR4Oxaj94/bio-dem-wins-2021-gbif-ebbe-nielsen-challenge) | Judges rewarded a tool that made data gaps and social/political context visible. | Bias and gap interpretation should be first-class, not a footnote. |
| 8 | [2020 winner ShinyBIOMOD](https://www.gbif.org/news/AcT155L4KYZ5RxsfDnGGt/shinybiomod-wins-2020-gbif-ebbe-nielsen-challenge) | ShinyBIOMOD helped non-specialists handle SDM complexity and bias/accounting best practices. | SDM questions need cautious triage, not a one-click "ready" answer. |
| 9 | [2019 winner WhereNext and runner-up occCite](https://www.gbif.org/news/2mixX9oDrJI2W3AqPFOxI3/wherenext-wins-2019-gbif-ebbe-nielsen-challenge) | WhereNext targeted data gaps; occCite targeted citation and data provenance. | GBIF Workbench should generate GBIF search URLs, DOI-backed download guidance, and citation instructions. |
| 10 | [2018 winners](https://www.gbif.org/news/4TuHBNfycgO4GEMOKkMi4u/six-winners-top-the-2018-ebbe-nielsen-challenge) | Winning projects covered checklist workflows, knowledge graphs, data validation, and issue exploration. | The challenge has room for infrastructure-like tools if they improve repeatable GBIF use. |
| 11 | [GBIF Strategic Framework 2023-2027](https://www.gbif.org/document/50lI7Bxn2p1vRgpbs7aXaT/gbif-strategic-framework-2023-2027) | GBIF emphasizes richer data, data uptake, citations, quality, policy use, and innovation. | GBIF Workbench should make uptake safer by connecting questions to fit-for-use caveats and reproducible workflows. |
| 12 | [GBIF Data Use Club](https://www.gbif.org/data-use-club) | GBIF runs practical sessions for APIs, rgbif, pygbif, taxonomic backbone, maps, cubes, and data quality. | There is proven demand for guided data-use education and repeatable examples. |
| 13 | [Occurrence data requirements](https://www.gbif.org/data-quality-requirements-occurrences) | Occurrence data are evidence of a taxon at a place and date; coordinate uncertainty and organism quantity affect usefulness. | The app should keep warning that occurrence count is not the same as scientific suitability. |
| 14 | [Sampling-event requirements](https://www.gbif.org/data-quality-requirements-sampling-events) | Sampling-event datasets can include methods, events, effort, relative abundance, and information that supports absence inference. | Population decline, monitoring, and abundance questions need event/effort signals, not occurrence-only confidence. |
| 15 | [GBIF SQL downloads](https://techdocs.gbif.org/en/data-use/api-sql-downloads) | SQL downloads support custom summary views through an asynchronous API with authentication. | Add a SQL starter query so advanced users can move from preview to summary cubes. |
| 16 | [GBIF species occurrence cubes](https://techdocs.gbif.org/en/data-use/data-cubes) | Cubes aggregate occurrence records by spatial, temporal, and taxonomic dimensions and include measures such as occurrence count and uncertainty. | GBIF Workbench should expose cube thinking for broad mapping and indicator-adjacent workflows. |
| 17 | [GBIF citation guidelines](https://www.gbif.org/citation-guidelines) | GBIF recommends DOI-backed downloads or derived datasets for transparent, reproducible citation. | The app must not let users confuse API preview with a final citable dataset. |
| 18 | [rgbif occurrence guidance](https://docs.ropensci.org/rgbif/articles/getting_occurrence_data.html) | rgbif advises `occ_download()` for serious research and citation, while `occ_search()` is mainly for testing. | Generated R code should privilege `occ_download()` and use search only for preview. |
| 19 | [GBIF data quality training](https://docs.gbif.org/course-data-mobilization/en/data-quality.html) | Data quality is framed as fitness-for-use with uncertainty, error, and bias. | GBIF Workbench's language should be "fit for this claim" rather than "good/bad data." |
| 20 | [Sampling-bias data-use article](https://www.gbif.org/data-use/6hL40kh9ikDXftobIM85KP/sampling-biases-shape-our-view-of-the-natural-world) | GBIF and OBIS records contain strong geographic and accessibility biases. | Spatial bias cards and source-dataset summaries are essential to the product. |
| 21 | [Data Use Club data quality discussion](https://discourse.gbif.org/t/data-use-club-practical-session-data-quality/3693) | Users need help interpreting GBIF issues and deciding what to clean or remove. | Show GBIF issue facets and export cleaning code. |
| 22 | [Data Use Club occurrence cubes discussion](https://discourse.gbif.org/t/data-use-club-practical-session-gbif-species-occurrence-cubes/5977) | Users ask about sampling effort, absence data, and how cube downloads relate to DOI-backed workflows. | Add cube-aware SQL and keep absence/effort limitations visible. |
| 23 | [Data Use Club occurrence maps discussion](https://discourse.gbif.org/t/data-use-club-practical-session-making-occurrence-maps/6130) | Recent sessions cover API downloads, rgbif mapping, SQL downloads, and gridded maps. | GBIF Workbench should bridge simple user questions into those reproducible technical paths. |
| 24 | [Reading GBIF downloads with R](https://discourse.gbif.org/t/reading-gbif-downloads-simple-csv-with-r/2615) | Users struggle with practical import details for GBIF downloads in R and Python. | Exports should include pragmatic code, not only conceptual guidance. |
| 25 | [Citing data not downloaded](https://discourse.gbif.org/t/citing-data-that-is-not-being-downloaded/4597) | API and temporary-use workflows raise citation ambiguity. | GBIF Workbench should explain when previews are enough and when DOI/derived dataset citation is required. |
| 26 | [API beginner tips](https://discourse.gbif.org/t/api-beginner-tips/5642) | Community support points beginners to API and species-information training. | The app can serve as an onboarding layer for users who are not API specialists. |
| 27 | [CoordinateCleaner docs](https://docs.ropensci.org/CoordinateCleaner/) | CoordinateCleaner is useful for improving quality of GBIF-sourced occurrence data in ecology, biogeography, conservation, and SDM. | Do not compete with CoordinateCleaner; generate downstream cleaning hooks and explain why. |
| 28 | [bdc package](https://brunobrr.github.io/bdc/) | bdc standardizes, integrates, flags, documents, cleans, and corrects biodiversity data. | GBIF Workbench's edge is pre-cleaning research triage; bdc-style cleaning can be a recommended next step. |
| 29 | [sampbias package](https://github.com/azizka/sampbias) | sampbias evaluates and visualizes geographic sampling bias in species distribution datasets. | GBIF Workbench should identify when sampling-bias analysis is needed, not try to replace specialized packages. |
| 30 | [occCite overview](https://www.ecography.org/blog/new-r-tools-acquire-manage-visualize-and-cite-occurrence-data) | occCite helps query, manage, summarize, and cite occurrence data and metadata. | Citation remains a high-value adjacent problem; GBIF Workbench should export citation instructions and preserve dataset keys. |
| 31 | [New data user forum question](https://discourse.gbif.org/t/how-to-get-started-with-gbif-data-for-my-research-any-tips/5884) | A new researcher described being overwhelmed by options and asked how to download/filter data for species or regions. | GBIF Workbench's first-run experience should translate a research question into concrete filters without requiring API knowledge. |
| 32 | [Occurrence growth forum question](https://discourse.gbif.org/t/how-to-see-number-of-occurrences-growth-in-gbif/5880) | A policy/reporting user confused record event time with publication/reporting time and needed filtered growth counts. | Temporal questions need explicit interpretation of what "growth", "trend", and "since" mean before query generation. |
| 33 | [Trait data forum question](https://discourse.gbif.org/t/best-approach-to-join-trait-data-with-gbif-occurrences/5983) | A user needed to join GBIF occurrences to trait data and asked for workflow/code help. | GBIF Workbench should keep surfacing extra-data requirements when the claim needs traits, environment, effort, or protocols. |
| 34 | [Derived dataset guidance](https://data-blog.gbif.org/post/derived-datasets/) | Derived datasets solve the problem of citing filtered/API/cloud subsets without a conventional GBIF download DOI. | Export citation guidance should mention derived datasets and preserve datasetKey/count information. |
| 35 | [rgbif citation workflow](https://docs.ropensci.org/rgbif/articles/gbif_citations.html) | rgbif documents DOI citation, `gbif_citation()`, and derived dataset registration with datasetKey/count pairs. | Citation should be visible in the UI, not buried only in a ZIP file. |
| 36 | [GBIF API reference](https://techdocs.gbif.org/en/openapi/) | GBIF recommends repeatable scripts/workflows and warns large search API jobs should become downloads for citation/load reasons. | Export the predicate download request JSON directly, not only preview URLs. |
| 37 | [API Downloads docs](https://techdocs.gbif.org/en/data-use/api-downloads) | Download requests require a GBIF account and a predicate JSON body; completed downloads provide link and DOI. | GBIF Workbench should show the exact predicate request shape with placeholder account details. |
| 38 | [Cloud services docs](https://techdocs.gbif.org/en/cloud-services/) | GBIF publishes monthly snapshots to Azure, AWS, GCS, and BigQuery, with snapshot DOI and derived-dataset advice. | Advanced users need a path beyond ordinary downloads; keep SQL/cube/cloud direction in documentation. |
| 39 | [Making occurrence maps session](https://www.gbif.org/event/7W6Cm2zvuCHnjqelDmWcD/data-use-club-practical-session-making-occurrence-maps) | GBIF trains users on data quality, Map API, local downloads, and occurrence cubes together. | GBIF Workbench should package map/SDM-oriented outputs as a coherent workflow bundle. |
| 40 | [API rate-limit forum question](https://discourse.gbif.org/t/question-regarding-api-rate-limits/5685) | App builders ask whether they should call GBIF APIs directly and cache results. | Keep short-lived server-side caching and recommend downloads for heavy jobs. |

## Competitive Map

### Directly Adjacent GBIF Tools

- GBIF.org occurrence search and APIs: strong for expert querying, weaker for research-question interpretation.
- rgbif and pygbif: excellent programmatic access, but users must already know filters, taxon scope, and citation workflow.
- GBIF SQL downloads and species occurrence cubes: powerful for summaries, but still require conceptual translation from research question to query.
- GBIF Data Use Club: strong education channel, not an interactive per-question planner.

### Data Cleaning And Quality Competitors

- CoordinateCleaner: spatial and temporal issue flagging after a user has records.
- bdc: broad biodiversity data standardization and cleaning.
- sampbias and occAssess: bias screening after data are assembled.
- GBIF Issues Explorer and similar dashboards: help inspect issues, but do not turn research intent into a full plan.

### Workflow And Citation Competitors

- occCite: citation and provenance management.
- galaxias: Darwin Core Archive publication workflows.
- ChatIPT: publication-side spreadsheet-to-DwC assistance.
- BDQEmail: biodiversity data-quality checks through an accessible interface.

### GBIF Workbench Wedge

GBIF Workbench sits before all of these:

1. User has a research idea.
2. GBIF Workbench interprets scope.
3. GBIF Workbench checks live GBIF availability.
4. GBIF Workbench separates possible claims from unsupported claims.
5. GBIF Workbench exports the next workflow for GBIF, rgbif, Python, SQL/cubes, predicate downloads, cleaning, methods, limitations, and citation.

This makes GBIF Workbench complementary to past winners, not a clone of them.

## What People Seem To Want

The ecosystem evidence points to repeated demand for:

- Beginner-friendly translation from research question to GBIF query.
- Clear distinction between occurrence records, sampling events, abundance, effort, absence, and monitoring data.
- Guidance on when GBIF can support mapping versus trend, decline, causal, or policy claims.
- Repeatable exports, not screenshots or transient chat answers.
- Practical R/Python/SQL workflows that lead to DOI-backed downloads.
- Download predicate JSON that users can inspect, edit, and turn into DOI-backed GBIF downloads.
- Transparent caveats around sampling bias, coordinate uncertainty, issue flags, source datasets, and citation.

GBIF Workbench should therefore optimize for trust and usefulness rather than visual novelty.

## Product Decisions Confirmed

- Keep the app version where it improves `IDEA.md`: structured OpenAI interpretation, live GBIF preview, editable scope, and notebook exports are better than a hardcoded rule-only MVP.
- Keep demo prompts as text starters only. No canned GBIF output, no fake charts, no static demo analysis.
- Keep the support headline nuanced. Avoid yes/no certification.
- Keep occurrence-only mismatch warnings prominent for decline, abundance, monitoring, and biodiversity-change questions.
- Add SQL/cube output because GBIF's current data-use ecosystem increasingly emphasizes gridded summaries and SQL downloads.
- Add visible predicate-download and citation tabs because user questions repeatedly expose confusion around API previews, downloads, and DOI obligations.
- Keep export-first design because past winners repeatedly win by lowering real workflow friction.

## Submission Positioning

Recommended one-liner:

> GBIF Workbench prevents bad GBIF data use before it happens by turning a research question into a live, reproducible, bias-aware GBIF data-use plan.

Recommended short abstract:

> GBIF Workbench is a pre-download research triage tool for GBIF-mediated biodiversity data. Users describe a proposed study in natural language; GBIF Workbench interprets the taxonomic, geographic, temporal, and analytical scope, checks live GBIF occurrence availability, identifies data-type mismatches and bias risks, and exports reproducible R, Python, SQL/cube, notebook, methods, limitations, and citation workflows. It helps users understand what GBIF can support, what requires additional data, and how to proceed without confusing data availability with scientific suitability.

## Remaining Pre-Submission Work

- Host a no-cost public demo with the OpenAI key kept server-side.
- Add a 2-3 minute demo video showing both a supported mapping/SDM case and an unsupported population-decline case.
- Add one live-generated example export to the submission package, clearly labeled as an example output rather than product demo data.
- Add repository setup instructions for environment variables, OpenAI model fallback, GBIF API behavior, and GBIF citation expectations.
- Run final browser QA on desktop and mobile before submission.
