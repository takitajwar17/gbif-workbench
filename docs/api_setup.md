# API Setup

StudyScout uses a local Express API that calls OpenAI and public GBIF endpoints. The browser never calls OpenAI directly.

## Environment

Create `apps/web/.env`:

```bash
OPENAI_API_KEY="..."
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
- Strict JSON schemas for intent, triage, risks, readiness dimensions, and workflow text

## Local API routes

- `GET /api/health`: confirms local API and OpenAI configuration.
- `POST /api/parse-intent`: returns interpreted study scope without running GBIF preview or assessment.
- `POST /api/study-plan`: runs intent interpretation, GBIF taxon resolution, GBIF preview, triage, and workflow generation.

The API sets `store: false` for model calls. If the configured model is unavailable to the key, the server queries `/v1/models` and chooses the strongest compatible GPT model available to that account.

## Used endpoints

- `https://api.gbif.org/v1/species/match`
- `https://api.gbif.org/v1/species/search`
- `https://api.gbif.org/v1/occurrence/search`
- `https://api.gbif.org/v1/dataset/{key}`
- `https://api.gbif.org/v1/dataset/search?type=SAMPLING_EVENT`

## Preview strategy

StudyScout uses `occurrence/search` with `limit=0` and facets for planning summaries:

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
