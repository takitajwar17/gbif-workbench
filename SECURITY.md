# Security Policy

## Supported versions

GBIF Workbench is pre-1.0. Security fixes target the current `main` branch.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that exposes credentials, account data, or private analysis history.

Report security issues by emailing the repository owner listed on GitHub, or by opening a private GitHub security advisory if available. Include:

- affected route or component,
- steps to reproduce,
- expected and observed behavior,
- any logs with secrets removed.

## Secrets and data handling

- OpenAI, Clerk, GBIF account, and database credentials must remain server-side.
- `.env`, `.env.local`, Vercel project metadata, local logs, and generated private analyses must not be committed.
- Browser exports should contain only the current analysis package and must not include service credentials.
- GBIF download code should use user-supplied GBIF.org credentials locally; the app must not collect or store GBIF passwords.
