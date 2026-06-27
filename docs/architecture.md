# Architecture

GBIF Workbench is a single-page React 19 + Vite 8 application backed by
five Vercel Node.js serverless endpoints. Authentication uses Clerk;
history persistence uses a Vercel Marketplace Neon Postgres database;
AI text generation uses OpenAI structured outputs through the Responses
API; GBIF-mediated occurrence data is previewed live through the public GBIF API — no caching
of occurrence payloads beyond a short server-side TTL. Transient GBIF
network failures, request timeouts, rate limits, and 5xx responses are
retried with bounded exponential backoff.

The product is deliberately split into deterministic and AI-driven
paths so an AI outage never blocks the deliverable artifact.

## Component map

```
Browser (React 19 + Vite + shadcn/ui + Tailwind 4)
   │
   │ Clerk session token (browser → server)
   │
   ▼
Vercel Node.js serverless functions
   ├── /api/health              (public; service status)
   ├── /api/parse-intent        (auth; OpenAI intent parse, optional)
   ├── /api/study-plan          (auth; occurrence preview + assessment)
   ├── /api/workflow            (auth; workflow package + ZIP-ready files)
   └── /api/history             (auth; Neon-backed run history)
   │
   ├── server/openai.js         (Responses API client + LRU cache + retry policy)
   ├── server/gbif.js           (taxon resolution, occurrence preview, query builder)
   ├── server/workflow.js       (finalizeWorkflow, normalizeTriage, body validation)
   ├── server/historyStore.js   (Neon-backed CRUD)
   ├── server/auth.js           (Clerk session verification)
   ├── server/lib/fallbackTriage.js   (deterministic assessment from live preview)
   ├── server/lib/fallbackWorkflow.js (deterministic export package)
   ├── server/lib/fallbackPolicy.js   (transient-AI-error classifier)
   ├── server/lib/codeValidator.js    (R + Python parse check on emitted code)
   ├── server/lib/readinessFormula.js (4-dimension readiness, no averaging)
   └── server/lib/openaiSchemas.js + openaiPrompts.js
       (strict JSON schemas and prompt instructions for each AI call)

Browser-side
   ├── src/lib/exportPackage.ts (Markdown, HTML, Quarto, Jupyter, ZIP assembly)
   ├── src/lib/queryGuard.ts    (prompt-injection regex list)
   ├── src/components/          (workspace UI, tabs, cards, history)
   └── scripts/check-workflow-runnable.mjs (CLI proof-of-runnability harness)
```

## Request flow (typical session)

1. The user enters a research question in the browser.
2. **POST `/api/parse-intent`** — The server asks OpenAI to extract
   the interpreted scope (taxon text, region, years, analysis type)
   using the strict intent JSON schema. The browser shows the user
   the interpreted scope for editing before any GBIF request runs.
   This is optional in flow terms but mandatory in practice — every
   downstream call depends on a stable intent shape.
3. **POST `/api/study-plan`** — Three things happen in parallel where
   possible:
   - `resolveTaxon` calls `https://api.gbif.org/v1/species/match` to
     resolve the taxon against the GBIF Backbone.
   - `buildGbifQuery` constructs the GBIF occurrence API request
     (taxonKey + country + year + hasCoordinate + hasGeospatialIssue
     filters) and the GBIF.org human-facing search URL.
   - `previewGbifData` calls `https://api.gbif.org/v1/occurrence/search`
     with the constructed parameters and a sample of records to
     retrieve occurrence counts, year and country facets, basis-of-record facets,
     dataset facets, issue-flag facets, taxonomic breakdown, and
     coordinate uncertainty summary.
   GBIF API calls use a short-lived LRU+TTL cache and retry transient
   failures before surfacing errors. Then `assessTriage` (or
   `createFallbackTriage` on transient AI
   failure) generates qualitative fitness-for-use and risk judgments grounded
   in the occurrence-search preview. `normalizeTriage` overwrites the readiness
   dimensions with deterministic, repeatable values computed from the
   preview — the LLM is not allowed to fabricate readiness numbers.
   If history storage is configured, this preview-ready assessment is
   saved to the signed-in account immediately.
4. The browser renders scope interpretation, occurrence-search preview cards,
   fitness-for-use and risk panels. The user can edit the scope and
   re-run.
5. **POST `/api/workflow`** — Generates the long-form reproducible
   code (R, Python, cleaning pipeline, SQL/cube starter, predicate
   download request JSON), methods text, limitations text, citation
   instructions, Markdown and HTML reports. If the AI succeeds, the
   emitted R and Python are parse-checked with `Rscript` /
   `python3` (`server/lib/codeValidator.js`) before being returned.
   If parsing fails, or the AI call transient-fails, the handler
   falls back to the deterministic export package so the ZIP is
   always producible. When history storage is configured, the existing
   preview-ready history row is updated with the workflow package.
6. The browser assembles the export ZIP in-memory with
   `src/lib/exportPackage.ts` and offers it as a download.

## Deterministic vs AI-driven paths

GBIF Workbench runs AI calls behind a strict policy: every AI call
is bounded by a per-attempt timeout and a retry budget, every AI
output is constrained by a JSON schema, and every AI path has a
deterministic replacement that takes the same inputs and produces
the same shape of output.

| AI call | Deterministic replacement | When the replacement runs |
| --- | --- | --- |
| Intent parse (`/api/parse-intent`) | (none — required for GBIF query) | AI failure surfaces as a 500 |
| Fitness-for-use assessment (`/api/study-plan`) | `server/lib/fallbackTriage.js` from live occurrence-search preview | `shouldUseDeterministicFallback` matches |
| Workflow (`/api/workflow`) | `server/lib/fallbackWorkflow.js` (hand-written R/Python/cleaning/Markdown) | `shouldUseDeterministicFallback` matches, or static parse check fails |

The transient-failure classifier (`server/lib/fallbackPolicy.js`)
matches: timed out, network failed, invalid JSON from the model, no
structured output, HTTP 5xx, HTTP 429. Anything else surfaces as a
real error and the user sees it.

## Code-parse safety net

LLM-emitted R and Python are not executed — workflow packages are
designed to run on the user's local machine with their own GBIF
credentials. Instead, the emitted source is fed to
`Rscript --vanilla --no-save -e "parse(text = …)"` and
`python3 -c "compile(sys.stdin.read(), '<generated>', 'exec')"` with a
5-second SIGKILL timeout. If a binary is not on the deploy image's
PATH (the Vercel Hobby default), the validator returns `skipped`
with an install hint rather than failing the workflow. If a binary
IS present and the emitted code is unparseable, the handler falls
through to the deterministic package so the user never receives a
ZIP full of broken code.

The same validator is exposed as `npm run check:runnable` and
`npm run check:validator` for offline use by reviewers.

## Why split `/api/study-plan` from `/api/workflow`?

Vercel Hobby serverless functions have a 60-second wall-clock budget.
The old combined endpoint had to fit intent parse + occurrence-search preview +
assessment + workflow generation + ZIP preparation in that window, which
forced aggressive AI timeouts and made deterministic fallback common.
Splitting into two endpoints gives each call its own 60s budget and
lets the user see the result card immediately while the workflow
streams in. The browser fires them sequentially; each has its own
transient-failure handling.

## Data sources

- **GBIF Backbone** (`https://api.gbif.org/v1/species/match`) — taxon
  resolution with confidence and alternatives.
- **GBIF occurrence search** (`https://api.gbif.org/v1/occurrence/search`)
  — occurrence-search preview counts, facets, sample points.
- **OpenAI Responses API** (`https://api.openai.com/v1/responses`) —
  structured outputs for intent, fitness-for-use assessment, and workflow text.
- **Clerk** — session token verification on every authenticated
  endpoint.
- **Vercel Marketplace Neon Postgres** — analysis-history persistence.

## What GBIF Workbench does not do

- Does not download occurrence records on the user's behalf — it produces
  download code that the user runs locally with their own GBIF
  credentials, so the resulting download has a citable DOI.
- Does not assign a universal data-quality score — readiness is
  reported as four separate dimensions (spatial, temporal,
  taxonomic, data-type) so it cannot be collapsed into one headline
  number.
- Does not train on user data, does not retain prompts server-side
  beyond the optional history feature, and does not require a
  user-supplied API key to operate.
- Does not execute LLM-emitted R or Python. Research use cases
  depend on the user's local toolchain with their GBIF credentials;
  the server only parse-checks.
