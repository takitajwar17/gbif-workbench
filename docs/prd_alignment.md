# IDEA.md Alignment Notes

This implementation follows the GBIF StudyScout product definition in `IDEA.md` with one intentional architecture change: the PRD's deterministic service sketch is replaced by OpenAI structured outputs plus live GBIF previews. That version is better for the current product because it handles ambiguous natural-language study scopes, region definitions, and report drafting without shipping hardcoded demo interpretations.

## Kept Because The App Version Is Better

- One `/api/study-plan` orchestration endpoint remains the main workflow instead of requiring separate user-facing parse, preview, triage, and workflow endpoints.
- OpenAI structured outputs replace a local hardcoded rule engine, while the prompt guardrails and JSON schemas remain visible in `apps/web/server/openai.js`.
- Demo prompts are text starters only. They never load canned reports or fake GBIF data.

## PRD Gaps Closed

- Added a parse-only `/api/parse-intent` endpoint so users can interpret and edit scope before running the heavier GBIF preview and assessment.
- Added advanced fields for spatial resolution and user skill level.
- Added taxonomic breakdown, GBIF issue/flag summary, and coordinate uncertainty preview sections.
- Expanded risk cards with evidence, why it matters, mitigation, and related workflow step.
- Added visible GBIF filters, recommended filters, and cleaning workflow tab.
- Added SQL/cube workflow output, predicate-download JSON, visible citation guidance, Quarto and Jupyter notebook-style exports, and included them in the ZIP package.
- Tightened model instructions so the primary support headline avoids yes/no simplification and exported reports include the PRD-required sections.
