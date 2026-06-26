# IDEA.md Alignment Notes

This implementation follows the GBIF Workbench product definition in `IDEA.md` with one intentional architecture change: the app uses OpenAI structured outputs for ambiguous natural-language interpretation and richer assessment text, while keeping deterministic preview-based fallback paths for triage and export generation. That hybrid version is better for the current product because it handles ambiguous study scopes without shipping canned demo results, but still keeps live GBIF preview and export workflows usable when optional AI calls time out.

## Kept Because The App Version Is Better

- `/api/study-plan` remains the main preview and triage endpoint, while `/api/workflow` is split out so export generation can run separately and degrade gracefully.
- OpenAI structured outputs handle intent, AI triage, and AI workflow text, while deterministic fallbacks produce conservative triage and export files from live GBIF inputs when optional AI calls time out.
- Demo prompts are text starters only. They never load canned reports or fake GBIF data.

## PRD Gaps Closed

- Added a parse-only `/api/parse-intent` endpoint so users can interpret and edit scope before running the heavier GBIF preview and assessment.
- Added advanced fields for spatial resolution and user skill level.
- Added taxonomic breakdown, GBIF issue/flag summary, and coordinate uncertainty preview sections.
- Expanded risk cards with evidence, why it matters, mitigation, and related workflow step.
- Added visible GBIF filters, recommended filters, and cleaning workflow tab.
- Added SQL/cube workflow output, predicate-download JSON, visible citation guidance, Quarto and Jupyter notebook-style exports, and included them in the ZIP package.
- Tightened model instructions so the primary support headline avoids yes/no simplification and exported reports include the PRD-required sections.
