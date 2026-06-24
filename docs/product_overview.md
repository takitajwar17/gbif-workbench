# Product Overview

GBIF Workbench turns a proposed biodiversity research question into a defensible GBIF data-use plan.

The product answers:

- What taxon, region, time range, and analysis type did the user imply?
- What GBIF-mediated data appear available before full download?
- What can ordinary occurrence records support?
- What claims require additional data types, such as sampling events, effort, absence, or abundance?
- What filters, cleaning steps, citation steps, and workflow code should the user run next?

## MVP user flow

1. The user enters a research question in natural language.
2. GBIF Workbench sends the question and optional overrides to the local API.
3. OpenAI returns a structured interpretation of the taxon, region, country filters, years, and analysis type.
4. GBIF Workbench resolves the taxon through the GBIF Backbone.
5. GBIF Workbench queries public GBIF occurrence summaries and sample records.
6. OpenAI generates support classification, risks, workflow code, methods text, limitations text, and citation instructions from the live GBIF preview.
7. The user can confirm or correct taxon, region, country filters, years, and analysis type, then rerun the same live pipeline.
8. The user exports Markdown, HTML, JSON, SQL, GBIF predicate request JSON, Quarto, Jupyter, or ZIP workflow files.

## Core product principle

GBIF Workbench always separates:

- data availability,
- data suitability,
- scientific claim strength.

A large number of records does not automatically imply suitability for a strong scientific claim.

## Demo prompt policy

The UI may include prompt starters to help users try realistic research questions. These prompts only populate the question field. GBIF Workbench renders results only after the app API calls OpenAI and live GBIF endpoints, and the repository does not ship static study-plan examples as product data.
