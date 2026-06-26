# API Setup

GBIF Workbench uses a local Express API that calls OpenAI and public GBIF endpoints. The browser never calls OpenAI directly.

## Environment

Create `apps/web/.env`:

```bash
OPENAI_API_KEY="..."
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
OPENAI_MODEL_INTENT="gpt-5.4-mini"
OPENAI_MODEL_ASSESSMENT="gpt-5.4-mini"
OPENAI_REASONING_EFFORT_INTENT="low"
OPENAI_REASONING_EFFORT_ASSESSMENT="low"
```

The `.env` file is ignored by git.

## OpenAI usage

- `POST /v1/responses`
- Structured Outputs with strict JSON schemas
- Intent extraction from the user's research question and optional overrides
- Study assessment and workflow generation grounded in the live GBIF preview
- Deterministic triage and workflow fallback paths when optional assessment/workflow AI calls time out
- Strict JSON schemas for intent, triage, risks, readiness dimensions, and workflow text

## Local API routes

- `GET /api/health`: confirms local API and OpenAI configuration.
- `POST /api/parse-intent`: requires a verified Clerk session and returns interpreted study scope without running GBIF preview or assessment.
- `POST /api/study-plan`: requires a verified Clerk session, runs intent interpretation, GBIF taxon resolution, GBIF preview, and triage. If the optional AI triage call times out, the API returns conservative deterministic triage from the live preview.
- `POST /api/workflow`: requires a verified Clerk session and generates exportable workflow files from the resolved intent, query, preview, and triage. If the optional AI workflow call times out, the API returns deterministic R, Python, SQL, predicate, cleaning, writeup, citation, Markdown, HTML, notebook, and ZIP-ready content from the live inputs.

## Authentication

GBIF Workbench uses Clerk for Google sign-in. The page remains public, but analysis API calls require a Clerk session token. In development, Clerk can use shared Google OAuth credentials for social sign-in. Production Clerk instances require the app's own Google OAuth credentials in the Clerk dashboard.

For the linked Clerk app from the project docs, authenticate the Clerk CLI and initialize with:

```bash
clerk auth login
clerk init --app app_3Fep5CGqjTNdmkeXjb6ETymJZFv
```

The browser sends the Clerk session token as `Authorization: Bearer ...` to protected API routes. The API verifies that token with `CLERK_SECRET_KEY` before it calls OpenAI or GBIF. Set `CLERK_AUTHORIZED_PARTIES` to comma-separated app origins when you want Clerk's `azp` claim checked as well.

The API sets `store: false` for model calls. If the configured model is unavailable to the key, the server queries `/v1/models` and chooses the strongest compatible GPT model available to that account.

## Used endpoints

- `https://api.gbif.org/v1/species/match`
- `https://api.gbif.org/v1/species/search`
- `https://api.gbif.org/v1/occurrence/search`
- `https://api.gbif.org/v1/dataset/{key}`
- `https://api.gbif.org/v1/dataset/search?type=SAMPLING_EVENT`

## Preview strategy

GBIF Workbench uses `occurrence/search` with `limit=0` and facets for planning summaries:

- `year`
- `country`
- `basisOfRecord`
- `datasetKey`
- `issue`
- `speciesKey`

It also fetches a small sample of georeferenced records for map preview and coordinate uncertainty diagnostics. These facts are passed to OpenAI so generated claims are grounded in live GBIF results.

## Download strategy

The app does not submit authenticated GBIF downloads. Instead, it generates rgbif and API code that users can run locally with their GBIF.org credentials. This avoids collecting GBIF credentials in the app and preserves GBIF DOI-backed reproducibility.

## Caching

The server keeps short-lived in-memory GBIF API cache entries to reduce repeated preview calls during editing. Live requests still work if the cache is empty.
