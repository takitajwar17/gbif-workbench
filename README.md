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

## How it works

```mermaid
flowchart TD
    User[Researcher types question<br/>and clicks Assess study]
    Browser[React browser app<br/>no direct OpenAI/GBIF calls]

    Auth[Clerk: verify bearer token<br/>+ prompt-injection guard]

    Intent[/api/parse-intent<br/>interpretStudyIntent/]
    Taxon[/species/match + /species/search/]
    Preview[/occurrence/search x4<br/>+ dataset, sampling-event/]

    Tri[OpenAI: assessTriage]
    TriFB{{fallbackTriage.js<br/>deterministic}}
    Norm[normalizeTriage<br/>overwrites readiness<br/>with computeReadiness]

    Save1[(Neon: INSERT<br/>status = preview_ready)]

    Card[Result card renders<br/>scope · preview · triage · risks]

    Workflow[/api/workflow<br/>assessWorkflow · AbortController/]
    Parse[codeValidator<br/>Rscript + python3 parse]
    WFB{{fallbackWorkflow.js<br/>hand-written R/Python}}

    Save2[(Neon: UPSERT<br/>status = workflow_ready)]

    Zip[Browser assembles ZIP]

    Out[User runs ZIP locally<br/>occ_download with their<br/>GBIF credentials, gets DOI]

    History[History drawer<br/>getHistoryEntry]

    User --> Browser
    Browser -->|POST + Bearer token| Auth
    Auth --> Intent
    Auth --> Taxon
    Intent --> Preview
    Taxon --> Preview
    Preview --> Tri
    Tri -->|AI ok| Norm
    Tri -->|timeout / 5xx / 429| TriFB --> Norm
    Norm --> Save1
    Save1 --> Card

    Card -.fire-and-forget.-> Workflow
    Workflow --> Parse
    Parse -->|valid code| Save2
    Parse -->|unparseable| WFB --> Save2
    Workflow -->|timeout / 5xx / 429| WFB --> Save2
    Save2 --> Zip
    Zip --> Out

    History -.next visit.->|GET /api/history?id| Save1
    Save1 -.-> Card
```

A typical run moves left to right across five lanes:

1. **Browser.** Researcher types a question. Every API call sends a Clerk bearer token.
2. **API.** `parse-intent` interprets the question, `study-plan` resolves the taxon against the GBIF Backbone and fetches a live occurrence-search preview, `workflow` generates the long-form reproducible code.
3. **AI + data.** OpenAI structured outputs do the interpretive work. Public GBIF endpoints supply live counts, facets, datasets, and sampling-event discovery.
4. **Deterministic fallbacks.** When the optional AI call times out, returns 5xx/429, or emits unparseable code, a hand-written replacement produces the same shape of output from the live preview.
5. **Persistence.** A `preview_ready` row saves as soon as the assessment card is ready. The same row is upserted to `workflow_ready` when the export package finishes. The history drawer restores from the JSON payload column.

The ZIP the browser produces is designed to run on the researcher's local machine with their own GBIF credentials, so the resulting download gets a citable DOI from GBIF. The app never stores GBIF credentials and never downloads records on the user's behalf.

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
- OpenAI Responses API structured outputs for intent extraction, fitness-for-use assessment, and workflow text, with deterministic live-preview fallbacks for assessment and exports.
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
apps/web/                    React + Vite app with Express/Vercel API routes
apps/web/server/             OpenAI, GBIF, auth, history, retry, and workflow logic
apps/web/src/components/ui   shadcn-style UI primitives
apps/web/src/lib/            browser export, formatting, map, and risk helpers
docs/architecture.md         system design and request flow
docs/configuration.md        environment, auth, database, and API setup
docs/scientific-guardrails.md fitness-for-use language and model-output rules
CONTRIBUTING.md              local setup and pull request expectations
SECURITY.md                  vulnerability reporting and secret-handling policy
CODE_OF_CONDUCT.md           contributor conduct expectations
```

## Contributing

Issues and pull requests are welcome. Please read `CONTRIBUTING.md` and keep changes aligned with the scientific guardrails in `docs/scientific-guardrails.md`.
