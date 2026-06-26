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

OpenAI and Clerk server credentials live in `apps/web/.env`. Vercel Marketplace database credentials live in `apps/web/.env.local`. Both files are used only by the local API server, while the browser uses `VITE_CLERK_PUBLISHABLE_KEY` for Clerk's public client SDK. Generated workflows tell users how to run DOI-backed GBIF downloads locally with their own GBIF.org credentials.

Copy `.env.example` to `.env`, add `OPENAI_API_KEY`, then run `clerk auth login` and `clerk init --app app_3Fep5CGqjTNdmkeXjb6ETymJZFv` from this directory. The Clerk CLI writes `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `.env`.

Account history uses Vercel Marketplace Neon/Postgres. From this directory, run `vercel integration add neon --name gbif-workbench-history --plan free_v3 -m region=iad1 -m auth=false`, then `vercel env pull .env.local` so `DATABASE_URL` is available locally and in Vercel deployments.
