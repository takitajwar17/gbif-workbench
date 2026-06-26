# GBIF Workbench Web App

React + Vite implementation of GBIF Workbench with a local Express API.

## Scripts

```bash
npm run dev
npm run dev:api
npm run dev:web
npm run test
npm run build
```

## Source map

- `src/App.tsx`: product workspace UI.
- `server/index.js`: Express API routes and static production serving.
- `server/openai.js`: OpenAI Responses API calls with strict structured outputs.
- `server/gbif.js`: GBIF taxon resolution, occurrence preview, and query construction.
- `server/lib/fallbackTriage.js`: deterministic live-preview triage when optional AI assessment is unavailable.
- `server/lib/fallbackWorkflow.js`: deterministic export package generation when optional AI workflow generation is unavailable.
- `src/lib/exportPackage.ts`: browser ZIP export assembly.
- `src/lib/regions.ts`: country-code display/edit helpers.

## Credentials

OpenAI credentials live in `apps/web/.env` and are used only by the local API server. Generated workflows tell users how to run DOI-backed GBIF downloads locally with their own GBIF.org credentials.
