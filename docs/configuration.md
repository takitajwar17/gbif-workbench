# Configuration

GBIF Workbench uses a local Express API that calls OpenAI and public GBIF endpoints. The browser never calls OpenAI directly.

## Environment

Create `apps/web/.env`:

```bash
OPENAI_API_KEY=
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
OPENAI_MODEL_INTENT=gpt-5.4-mini
OPENAI_MODEL_ASSESSMENT=gpt-5.4-mini
OPENAI_REASONING_EFFORT_INTENT=low
OPENAI_REASONING_EFFORT_ASSESSMENT=low
```

The `.env` file is ignored by git. Database credentials for account history are pulled from Vercel into `apps/web/.env.local`.

Optional reliability knobs:

```bash
OPENAI_INTENT_ATTEMPT_TIMEOUT_MS=20000
OPENAI_INTENT_MAX_ATTEMPTS=2
OPENAI_TRIAGE_ATTEMPT_TIMEOUT_MS=12000
OPENAI_TRIAGE_MAX_ATTEMPTS=1
OPENAI_WORKFLOW_ATTEMPT_TIMEOUT_MS=15000
OPENAI_WORKFLOW_MAX_ATTEMPTS=1
OPENAI_RETRY_BACKOFF_MS=1000
GBIF_TIMEOUT_MS=90000
GBIF_MAX_ATTEMPTS=3
GBIF_RETRY_BACKOFF_MS=750
```

## OpenAI usage

- `POST /v1/responses`
- Structured Outputs with strict JSON schemas
- Intent extraction from the user's research question and optional overrides
- Fitness-for-use assessment and workflow generation grounded in the live occurrence-search preview
- Deterministic assessment and workflow fallback paths when optional assessment/workflow AI calls time out
- Strict JSON schemas for intent, assessment, risks, readiness dimensions, and workflow text

## Local API routes

- `GET /api/health`: confirms local API and OpenAI configuration.
- `GET /api/history`: requires a verified Clerk session and returns saved analysis history for the signed-in account.
- `GET /api/history?id=...`: requires a verified Clerk session and returns one full restorable history snapshot.
- `DELETE /api/history?id=...`: requires a verified Clerk session and deletes one saved history entry owned by the signed-in account.
- `POST /api/parse-intent`: requires a verified Clerk session and returns interpreted study scope without running the occurrence-search preview or assessment.
- `POST /api/study-plan`: requires a verified Clerk session, runs intent interpretation, GBIF taxon resolution, occurrence-search preview, and fitness-for-use assessment. If `DATABASE_URL` is configured, the preview-ready result is saved to account history. If the optional AI assessment call times out, the API returns a conservative deterministic assessment from the live preview.
- `POST /api/workflow`: requires a verified Clerk session and generates exportable workflow files from the resolved intent, query, preview, and assessment. Existing preview-ready history rows are updated when workflow exports finish. If the optional AI workflow call times out, the API returns deterministic R, Python, SQL, predicate, cleaning, writeup, citation, Markdown, HTML, notebook, and ZIP-ready content from the live inputs.

## Authentication

GBIF Workbench uses Clerk for Google sign-in. The page remains public, but analysis API calls require a Clerk session token. In development, Clerk can use shared Google OAuth credentials for social sign-in. Production Clerk instances require the app's own Google OAuth credentials in the Clerk dashboard.

Create a Clerk app, enable Google sign-in, and copy the publishable and secret keys into `apps/web/.env`. If using the Clerk CLI, run `clerk auth login` and initialize by selecting your Clerk project interactively. Do not commit Clerk app identifiers or keys.

The browser sends the Clerk session token as `Authorization: Bearer ...` to protected API routes. The API verifies that token with `CLERK_SECRET_KEY` before it calls OpenAI or GBIF. Set `CLERK_AUTHORIZED_PARTIES` to comma-separated app origins when you want Clerk's `azp` claim checked as well.

## Account history database

History uses a Vercel Marketplace Neon/Postgres database. Add the Neon integration to the linked Vercel project and pull env vars locally:

```bash
cd apps/web
vercel link
vercel integration add neon --name gbif-workbench-history --plan free_v3 -m region=iad1 -m auth=false
vercel env pull .env.local
```

If Vercel returns `integration_terms_acceptance_required`, open the verification URL it prints, accept the Neon Marketplace terms, then rerun the same `vercel integration add neon ...` command.

The API accepts `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, or `NEON_DATABASE_URL`. On first history use, the server creates `gbif_workbench_history` with a per-user index. Each row belongs to the Clerk `userId` and stores a compact list summary plus the full JSON snapshot needed to restore the preview assessment. When workflow exports finish, the same row is updated with the export package.

The API sets `store: false` for model calls. If the configured model is unavailable to the key, the server queries `/v1/models` and chooses the strongest compatible GPT model available to that account.

## Used endpoints

- `https://api.gbif.org/v1/species/match`
- `https://api.gbif.org/v1/species/search`
- `https://api.gbif.org/v1/occurrence/search`
- `https://api.gbif.org/v1/dataset/{key}`
- `https://api.gbif.org/v1/dataset/search?type=SAMPLING_EVENT`

## Occurrence-search preview strategy

GBIF Workbench uses `occurrence/search` with `limit=0` and facets for planning summaries:

- `year`
- `country`
- `basisOfRecord`
- `datasetKey`
- `issue`
- `speciesKey`

It also fetches a small sample of georeferenced records for map preview and coordinate uncertainty diagnostics. These facts are passed to OpenAI so generated claims are grounded in live occurrence-search results.

## Download strategy

The app does not submit authenticated GBIF occurrence downloads. Instead, it generates rgbif and API code that users can run locally with their GBIF.org credentials. This avoids collecting GBIF credentials in the app and preserves GBIF DOI-backed reproducibility.

## Caching

The server keeps short-lived in-memory GBIF API cache entries to reduce repeated preview calls during editing. Live requests still work if the cache is empty. Transient GBIF failures, timeouts, 429s, and 5xx responses are retried with bounded exponential backoff before the user sees an error.
