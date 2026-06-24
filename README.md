# GBIF StudyScout

GBIF StudyScout is a bias-aware pre-download research triage tool for GBIF-mediated biodiversity data. It helps users decide whether, when, and how GBIF data can support a proposed study before they request a full download.

The app uses a small Node/Express API. OpenAI structured outputs interpret the user's research question and generate the study assessment/workflow. Public GBIF APIs resolve taxa and fetch live occurrence-preview facts. The browser renders only live API results; demo prompts are only text starters and never load canned GBIF output.

## Why it exists

GBIF users often download first and reason about suitability later. StudyScout reverses that workflow:

1. Enter a research question.
2. Confirm taxon, region, date range, and analysis type.
3. Preview GBIF availability with aggregated facets.
4. Separate data availability from data suitability and claim strength.
5. Export a reproducible GBIF workflow and report.

StudyScout is deliberately not a generic biodiversity chatbot, not a full modelling platform, and not a universal data-quality score.

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Create `apps/web/.env` with `OPENAI_API_KEY`, then open the local URL printed by Vite. The dev script starts both the API server and Vite.

## Verify

```bash
cd apps/web
npm run test
npm run build
```

## MVP capabilities

- Natural-language parsing for taxon, region, years, and intended analysis.
- Demo prompt starters that populate the question field without bypassing live analysis.
- Parse-only scope interpretation before the heavier live GBIF preview.
- OpenAI Responses API structured outputs for intent extraction, study triage, and workflow text.
- Editable interpreted scope before and after preview, including spatial resolution and user skill level.
- GBIF Backbone taxon resolution through `species/match` and `species/search`.
- Public GBIF occurrence preview through `occurrence/search` counts, facets, issue flags, taxonomic breakdown, coordinate uncertainty, and sample points.
- Model-generated data-type triage for distribution/range-shift questions versus abundance/trend questions, grounded in the live GBIF preview.
- Bias/risk cards for spatial, temporal, source, taxonomic, citation, and occurrence-only mismatch risks.
- Generated GBIF.org search URL, API preview URL, rgbif workflow, Python workflow, GBIF predicate request JSON, SQL/cube starter query, cleaning pipeline, methods text, limitations text, and citation instructions.
- Markdown, HTML, JSON, predicate JSON, SQL, Quarto, Jupyter, and ZIP export from the browser.
- Short-lived server-side GBIF response caching.

## Important limitation

The browser preview does not create a GBIF download DOI. Serious research reuse should run the generated `rgbif::occ_download()` workflow or create a GBIF download through GBIF.org/API, then cite the resulting DOI. The app makes this visible in every generated report.

## Repository layout

```text
apps/web/                 React + Vite StudyScout app with an Express API
apps/web/server/          OpenAI, GBIF, and API route implementation
apps/web/src/lib/         browser export and formatting helpers
apps/web/src/lib/__tests__ focused utility tests
docs/                     product, API, and guardrail documentation
docs/prd_alignment.md     notes on IDEA.md alignment and intentional upgrades
docs/ecosystem_research.md competition and ecosystem research summary
docs/submission_strategy.md challenge submission strategy and checklist
IDEA.md                   original product requirements document
```

## Challenge positioning

StudyScout targets an under-served GBIF workflow stage: research-design triage before download. The value is not a flashy visualization; it is a repeatable, transparent decision-support layer that helps users avoid common misuse of occurrence-only data.
# gbif
