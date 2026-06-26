# Contributing

Thanks for helping improve GBIF Workbench. This project is a research-planning tool, so the bar for changes is simple: preserve scientific caution, keep outputs reproducible, and avoid making the interface look more certain than the data justify.

## Development setup

```bash
cd apps/web
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with an OpenAI API key and Clerk keys from your own Clerk app. Account history also needs a Postgres-compatible `DATABASE_URL`; Vercel Marketplace Neon is the documented path.

Never commit real API keys, Clerk identifiers, database URLs, `.env` files, downloaded GBIF data, or private user analyses.

## Before opening a pull request

Run:

```bash
cd apps/web
npm run lint
npm run test
npm run check:runnable
npm run check:validator
npm run build
```

Keep changes focused. If a change affects generated workflow files, include tests or fixtures that prove the R/Python/SQL/export path still works.

## Product rules

- Demo prompts may fill the input field, but must not load canned GBIF results.
- The app must not call a dataset "valid", "good", "bad", or "publishable."
- Occurrence-only data must not be presented as sufficient for abundance, decline, absence, or standardized monitoring claims.
- Browser previews are planning evidence, not DOI-backed final datasets.
- Generated workflows should guide users toward GBIF downloads or derived datasets when citation and repeatability matter.

See `docs/scientific-guardrails.md` before changing prompts, verdict language, exports, or report text.
