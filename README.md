# GBIF Workbench

[![CI](https://github.com/takitajwar17/gbif-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/takitajwar17/gbif-workbench/actions/workflows/ci.yml)

GBIF Workbench is a bias-aware pre-download research workbench for GBIF-mediated occurrence data. It helps researchers decide whether, when, and how occurrence records can support a proposed study before they request a DOI-backed GBIF download.

GBIF Workbench is independent software. It is not affiliated with, endorsed by, or operated by GBIF.org.

Public app: https://gbifworkbench.org/

Source repository: https://github.com/takitajwar17/gbif-workbench

License: MIT

The app uses a small Node/Express API. OpenAI structured outputs interpret the user's research question and generate richer fitness-for-use assessment and workflow text, while deterministic fallback paths keep assessment and exports usable if optional AI calls time out. Public GBIF APIs resolve taxa and fetch live occurrence-search preview facts. The browser renders only live API results; demo prompts are only text starters and never load canned GBIF output.

## Why it exists

Researchers often download GBIF-mediated occurrence records first and reason about fitness-for-use later. GBIF Workbench reverses that workflow:

1. Enter a research question.
2. Confirm taxon, region, date range, and analysis type.
3. Preview GBIF occurrence availability with aggregated occurrence-search facets.
4. Separate data availability from data suitability and claim strength.
5. Export a reproducible occurrence-download workflow and report.

GBIF Workbench is deliberately not a generic biodiversity chatbot, not a full modelling platform, and not a universal data-quality score.

Under the hood, the readiness rubric is grounded in seven published GBIF methodology papers, the AI calls run through strict JSON schemas with deterministic fallbacks, and the export package is parse-checked before it ships. The current build ships **120 tests across 13 files**, four orthogonal readiness dimensions, and a hand-written R / Python / SQL workflow that runs even if the AI step is unavailable.

![GBIF Workbench: question card on the left with an Alcedo atthis range-shift question, map preview in the centre with sampled European points, top-risk callout for occurrence-only data, and the workflow stepper (Question, Scope, Preview, Export) at the top](docs/screenshots/1.png)

**Ask a question.** The workspace shows the interpreted scope on the left, the live occurrence-search preview with sampled points and a coordinate-uncertainty note in the centre, and the top-risk callout for occurrence-only data on the right.

![GBIF Workbench result card: the same Alcedo atthis scope on the left, the occurrence-search preview in the centre showing 2,483,503 matching records, usable coordinates, sample points, and a coordinate-uncertainty note, and the fitness-for-use card on the right with four readiness bars (Spatial 100 STRONG, Temporal 95 STRONG, Taxonomic 93 STRONG, Data type fit 75 GOOD), a "Limited support" headline, and clear conditional / unsupported claim separation](docs/screenshots/2.png)

**Read the result card.** Four orthogonal readiness bars (Spatial, Temporal, Taxonomic, Data type fit), a clear support headline, and an explicit separation between claims occurrence-only data can support and claims it cannot.

![GBIF Workbench bias checks and export panel. Left: the bias and limitation card with 4 checks (one HIGH occurrence-only-mismatch risk, one MODERATE AI-fallback notice, two LOW coverage risks). Right: the export panel with Code / Query / Write-up / Cleaning tabs, showing the generated SQL cube starter query against the GBIF occurrence cube, the SQL and Predicate tabs, and the Analysis summary, Complete JSON, and Download everything (.zip) buttons.](docs/screenshots/3.png)

**Bias checks and export package.** The bias card on the left flags data-use risks for the proposed study; the export panel on the right ships a reproducible R, Python, SQL, cleaning, methods, limitations, citations, Markdown, and HTML workflow, plus the analysis summary, complete JSON, and a single ZIP built in the browser.

## How it works

```mermaid
flowchart TB
    User([Researcher types a<br/>biodiversity question])
    User --> App[Browser app]

    subgraph Inputs
        direction LR
        Intent[Interpret the question<br/>taxon, region, years, claim]
        Resolve[Match the taxon on<br/>the GBIF Backbone]
        App --> Intent
        App --> Resolve
    end

    Intent --> Search[Live occurrence search<br/>counts, facets, issues]
    Resolve --> Search

    Search --> Assess{Assess fitness<br/>for use}
    Assess -->|AI ok| Ready[Readiness scores<br/>and risks]
    Assess -->|timeout or error| AssessFB{{Deterministic<br/>fallback}}
    AssessFB --> Ready

    Ready --> Save1[(Save preview to<br/>account history)]
    Save1 --> Card[Result card shows<br/>scope, evidence, caveats]

    Card -.background.-> Workflow[Generate reproducible<br/>R, Python, SQL]
    Workflow --> Parse[Static-check the<br/>generated code]

    subgraph Handlers
        direction LR
        Parse -->|code parses| Save2[(Update history row<br/>with workflow)]
        Parse -->|code broken| WorkflowFB{{Deterministic<br/>fallback}}
        Workflow -->|timeout or error| WorkflowFB
        WorkflowFB --> Save2
    end

    Save2 --> Zip[Export package<br/>ready in browser]
    Zip --> Out([Researcher runs the package<br/>locally and gets a DOI<br/>back from GBIF])

    History([History drawer<br/>on return visits]) -.->|restore| Save1
    Save1 -.-> Card
```

A typical run flows top to bottom across four lanes:

1. **Interpret.** The researcher's plain-language question becomes a structured study scope (taxon, region, year window, intended claim) and the taxon is resolved against the GBIF Backbone.
2. **Preview.** GBIF Workbench fetches a live occurrence-search preview for the exact scope: matching records, usable coordinates, year and country facets, datasets, issue flags, and a sampling-event discovery signal.
3. **Assess and export.** A fitness-for-use assessment separates data availability from claim strength. If the optional AI step times out, a deterministic fallback produces the same shape from the live preview. A reproducible R / Python / SQL export package follows; if the generated code fails to parse, a hand-written fallback ships instead.
4. **Persist and reuse.** A preview-ready row saves to the signed-in researcher's history as soon as the assessment card is ready, then is updated when the workflow exports finish. The researcher runs the exported package locally with their own GBIF credentials and gets a citable DOI back from GBIF. The history drawer restores a previous analysis in one click.

## Run locally

```bash
cd apps/web
npm install
cp .env.example .env
npm run dev
```

Fill `apps/web/.env` with:

- `OPENAI_API_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Create a Clerk app with Google sign-in enabled, then copy the publishable and secret keys into `.env`. If you use the Clerk CLI, authenticate with `clerk auth login` and initialize the local app by selecting your Clerk project interactively.

Account history uses a Vercel Marketplace Neon/Postgres database. Add the Neon integration to the Vercel project and pull env vars so `DATABASE_URL` is present locally:

```bash
cd apps/web
vercel link
vercel integration add neon --name gbif-workbench-history --plan free_v3 -m region=iad1 -m auth=false
vercel env pull .env.local
```

Then open the local URL printed by Vite. The dev script starts both the API server and Vite.

## Verify

```bash
cd apps/web
npm run lint
npm run test
npm run check:runnable
npm run check:validator
npm run build
```

## Capabilities

- Natural-language parsing for taxon, region, years, and intended analysis.
- Demo prompt starters that populate the question field without bypassing live analysis.
- Researcher-focused shadcn/ui + Tailwind interface with accessible forms, cards, tabs, alerts, and export controls.
- Parse-only scope interpretation before the heavier live occurrence-search preview.
- OpenAI Responses API structured outputs for intent extraction, fitness-for-use assessment, and workflow text. Intent failures surface as errors (intent is required); assessment and workflow have deterministic fallbacks grounded in the live occurrence-search preview.
- Clerk account auth and Vercel-backed analysis history, with restore/delete controls for saved assessments that update when workflow exports finish.
- Editable interpreted scope before and after preview, including spatial resolution and user skill level.
- GBIF Backbone taxon resolution through `species/match` and `species/search`.
- Public GBIF occurrence-search preview through `occurrence/search` counts, facets, issue flags, taxonomic breakdown, coordinate uncertainty, and sample points.
- Model-generated data-type fit assessment for distribution/range-shift questions versus abundance/trend questions, grounded in the live occurrence-search preview.
- Bias/risk cards for spatial, temporal, source, taxonomic, citation, and occurrence-only mismatch risks.
- Generated GBIF.org occurrence search URL, occurrence-search API URL, rgbif workflow, Python workflow, GBIF occurrence download predicate JSON, SQL/cube starter query, cleaning pipeline, methods text, limitations text, and citation instructions.
- Markdown, HTML, complete analysis JSON, deterministic analysis summary, predicate JSON, SQL, Quarto, Jupyter, and ZIP export from the browser.
- Short-lived server-side GBIF response caching.

## Important limitation

The occurrence-search preview does not create a GBIF download DOI. Serious research reuse should run the generated `rgbif::occ_download()` workflow or create a GBIF occurrence download through GBIF.org/API, then cite the resulting DOI. The app makes this visible in every generated report.

## Repository Layout

```text
apps/web/                        React 19 + Vite app, Express/Vercel serverless API
apps/web/api/                   Vercel serverless function entry points
  health.js, history.js, parse-intent.js, study-plan.js, workflow.js
apps/web/server/                OpenAI, GBIF, auth, history, and orchestration logic
apps/web/server/lib/            Pure helpers, deterministic fallbacks, and validators
  readinessFormula.js           literature-grounded 4-dimension readiness rubric
  fallbackTriage.js             rule-based risk card when the AI assessment fails
  fallbackWorkflow.js           hand-written R, Python, and cleaning exports
  codeValidator.js              static R + Python parse check on AI-emitted code
  retryPolicy.js                exponential-backoff + token-budget escalation
  fallbackPolicy.js             transient-failure classifier for AI calls
  openaiSchemas.js              strict JSON schemas for the three AI calls
  openaiPrompts.js              guarded instructions + off-topic sentinel
  gbifQueryBuilders.js          URL, predicate, and SQL/cube builders
  lruTtlCache.js                shared LRU+TTL cache factory
apps/web/src/                   React client
  hooks/useAnalyze.ts           workspace state machine (race-safe, abort-aware)
  components/                   ui · form · question · preview · triage · workflow · header · history · api · layout · steps
  lib/                          browser export package, formatting, map, regions, query guard
apps/web/scripts/
  check-workflow-runnable.mjs   CLI harness: parse-checks generated R/Python
apps/web/.env.example           env var template (OpenAI, Clerk, Neon, retry budgets)
apps/web/vercel.json            Vercel function maxDuration + rewrites
apps/web/components.json        shadcn/ui generator config
docs/architecture.md            system design and request flow
docs/configuration.md           environment, auth, database, and API setup
docs/scientific-guardrails.md  fitness-for-use language and model-output rules
docs/product-demo-video.md      demo video shot list and voiceover script
CONTRIBUTING.md                 local setup and pull request expectations
SECURITY.md                     vulnerability reporting and secret-handling policy
CODE_OF_CONDUCT.md              contributor conduct expectations
```

## Contributing

Issues and pull requests are welcome. Please read `CONTRIBUTING.md` and keep changes aligned with the scientific guardrails in `docs/scientific-guardrails.md`.

## What this is not

GBIF Workbench has a deliberately narrow scope. It is intentionally **not**:

- A generic biodiversity chatbot, a full species distribution modelling platform, or a tool for population abundance, decline, occupancy, or causal-trend inference. The LLM is constrained by strict JSON schemas, the app does not fit or evaluate models, and GBIF-mediated occurrence-only data cannot support those claims — the app makes that explicit in every report.
- A replacement for a GBIF download DOI. The exported package is meant to be run on the researcher's local machine with their own GBIF credentials, and the resulting download is what gets cited.

## Acknowledgments

GBIF Workbench stands on the work of others:

- **[OpenAI](https://openai.com/)** — Responses API with structured outputs for intent extraction, fitness-for-use assessment, and workflow generation. Commercial API; the browser never calls it directly.
- **[Clerk](https://clerk.com/)** — Google sign-in and session token verification for protected API routes. Commercial service.
- **[Neon](https://neon.tech/)** — Vercel Marketplace Postgres for account history (preview-ready → workflow-ready upserts).
- **[React 19](https://react.dev/)**, **[Vite 8](https://vitejs.dev/)**, **[TypeScript 6](https://www.typescriptlang.org/)**, **[Tailwind CSS 4](https://tailwindcss.com/)** — the browser stack. All MIT.
- **[shadcn/ui](https://ui.shadcn.com/)** — UI primitives built on Radix UI (MIT) and Tailwind.
- **[d3-geo](https://d3js.org/d3-geo)** and **[topojson-client](https://github.com/topojson/topojson-client)** — map projection and geometry decoding. ISC.
- **[world-atlas](https://github.com/topojson/world-atlas)** — country outlines for the preview map. ISC.
- **[lucide-react](https://lucide.dev/)** — icon set. ISC.
- **[jszip](https://stuk.github.io/jszip/)** — browser-side ZIP assembly for the export package. Dual-licensed MIT or GPL-3.0-or-later; this project uses it under MIT.
- **[express](https://expressjs.com/)** — local dev API shell that mounts the same handlers Vercel serves from `apps/web/api/*.js`. MIT.
- **[CoordinateCleaner](https://github.com/ropensci/CoordinateCleaner)** — referenced in the generated R cleaning pipeline as an optional package. MIT.
