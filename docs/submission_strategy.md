# 2026 Ebbe Nielsen Challenge Submission Strategy

## Strategic Answer

We should submit StudyScout as a practical, open, repeatable pre-download planning tool for GBIF data users.

The product is stronger when judged against the challenge if it emphasizes:

- live GBIF previews instead of canned examples,
- cautious scientific triage instead of binary suitability scores,
- reproducible exports instead of transient chat output,
- DOI-backed GBIF download guidance,
- compatibility with the existing GBIF tooling ecosystem.

## Why This Can Win

Past winners repeatedly reduce friction in real GBIF workflows:

- ChatIPT helped transform spreadsheets into GBIF-ready data.
- BDQEmail made biodiversity data-quality checks easier to access.
- galaxias helped users publish Darwin Core Archives from R/Python.
- GBIF Alert made monitoring new occurrence records reusable.
- GridDER, bdc, ShinyBIOMOD, WhereNext, and occCite all targeted concrete data-use or workflow pain.

StudyScout follows that pattern but moves earlier in the workflow: before a download, before cleaning, before modelling, and before users overclaim from occurrence-only data.

## What To Avoid

- Do not pitch this as a generic AI assistant.
- Do not claim the app validates a dataset scientifically.
- Do not present static dashboard screenshots as the product.
- Do not rely on hardcoded examples.
- Do not make the submission about model cleverness. Make it about better GBIF data use.

## Judge-Facing Demo Script

1. Open StudyScout and enter: "I want to study climate-driven range shifts of kingfishers in Southeast Asia from 1990 to 2025."
2. Interpret scope first and show editable taxon, countries, years, and analysis type.
3. Run live preview and show occurrence counts, year/country facets, issue flags, taxonomic breakdown, coordinate uncertainty, and sampling-event discovery.
4. Show triage: what is supported, what is conditional, what is exploratory, and which claims are unsupported.
5. Open generated workflow tabs: R, Python, SQL, Predicate, Cleaning, Methods, Citation, Limitations.
6. Export ZIP and point to Markdown, Quarto, Jupyter, SQL, GBIF predicate request JSON, methods, limitations, and citation files.
7. Run the frog population-decline prompt to show that StudyScout refuses occurrence-only overclaiming and redirects users toward sampling events, effort, and monitoring data.

## Submission Checklist

- Public URL works without user-supplied API keys.
- Repository includes local setup and `.env.example`.
- OpenAI key is server-side only.
- No generated reports or charts are hardcoded into the UI.
- README states that GBIF API previews are not DOI-backed final downloads.
- Export ZIP includes GBIF download code, predicate download request JSON, SQL/cube starter query, cleaning checks, methods, limitations, and citation instructions.
- Demo video shows both a positive use case and a strong guardrail case.
- License is explicit.
- Challenge abstract explains relevance, novelty, quality, openness, and repeatability.
