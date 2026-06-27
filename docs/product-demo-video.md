# Product Demo Video Plan

This is a recording plan and natural voiceover script for a 3.5 to 4 minute product demo of GBIF Workbench.

The goal is not to explain every feature. The goal is to make a judge think: "I know this problem, this tool solves it in a practical way, and I want to try it on my own question."

## Core Message

GBIF Workbench helps researchers decide whether GBIF-mediated occurrence records fit a study before they commit to a download.

It turns a plain-language research question into:

- an interpreted study scope
- GBIF Backbone taxon resolution
- a live GBIF occurrence-search preview
- a cautious fitness-for-use assessment
- visible bias and limitation checks
- reproducible R, Python, SQL, predicate, cleaning, methods, citation, and ZIP exports
- signed-in account history for returning to previous analyses

The video should show one thing clearly: this is not a generic biodiversity chatbot. It is a pre-download research workbench connected to live GBIF services, built around occurrence-data fitness-for-use and repeatable workflows.

## Best Demo Question

Use the app's existing demo prompt:

I want to study climate-driven range shifts of common kingfishers (Alcedo atthis) in Europe from 1990 to 2025.

Why this prompt works:

- It sounds like a real biodiversity research question.
- It has a taxon, region, time window, and intended claim.
- It usually returns enough GBIF-mediated occurrence records to show maps, year facets, country distribution, datasets, issues, and uncertainty.
- It lets the app draw a useful boundary: occurrence records can support exploratory spatial and temporal scoping, but they cannot establish abundance change or population trend without additional sampling-effort information.

Do not read exact counts in the voiceover unless the recording shows them clearly. GBIF occurrence-search results are live, so numbers may change.

## Recording Setup

Record the public app at:

https://gbifworkbench.org/

Use a desktop browser around 1440 by 900 or 1600 by 1000. Keep browser zoom at 100 percent. Use a clean browser profile if possible.

Before the final take:

- Make sure Clerk sign-in works.
- Make sure the database-backed history drawer has at least one real previous analysis.
- Run the kingfisher prompt once to confirm GBIF and workflow generation are responsive.
- Keep the first recorded run live. If the spinner is long, cut the wait down in editing, but show enough of it that the viewer sees this is an actual request.
- If workflow generation falls back deterministically, that is acceptable. The app is designed for that path. Do not hide it if it appears; frame it as reliability.

## Story Arc

1. The researcher has a question.
2. The risky old workflow is to download first and discover the fit problems later.
3. GBIF Workbench checks the scope first.
4. It uses live GBIF occurrence-search facts, not demo data.
5. It separates availability from suitability.
6. It gives the researcher a repeatable export package.
7. It saves the analysis so the researcher can come back.
8. It is open and repeatable.

## Timeline And Shot List

| Time | Screen | Voiceover | Judge Signal |
| --- | --- | --- | --- |
| 0:00-0:12 | App open on the workspace. Cursor near the research question box. | "Here is the problem GBIF Workbench is built for. A researcher has a question, GBIF gives access to billions of species occurrence records, and the mistake is often downloading first and asking fit-for-use questions later." | Pain point, no long intro. |
| 0:12-0:28 | Click the kingfisher example or type/paste it. | "I start with the kind of question a researcher would actually ask: climate-driven range shifts of common kingfishers in Europe from 1990 to 2025." | Natural entry point. |
| 0:28-0:45 | Click Assess study while signed out. Show Clerk sign-in modal. Sign in with Google. | "The workspace is public, but running an assessment requires sign-in. That gives each researcher a private history and prevents anonymous use of the live API pipeline." | Auth and persistence. |
| 0:45-1:05 | Assessment starts. Show workflow progress and interpreted scope appearing. | "The first thing it does is not generate prose. It turns the question into a scope: taxon, region, years, language preference, and intended analysis. This is where wrong taxon names and vague regions get caught early." | Structured interpretation, not chatbot. |
| 1:05-1:30 | Zoom or pan to interpreted scope. If needed, edit a field and show Re-run state. | "The scope is editable. If the researcher sees the wrong region or wants a narrower year range, they can fix it before treating the result as evidence." | Human-in-the-loop control. |
| 1:30-2:05 | Show occurrence-search preview: counts, usable coordinates, map, year histogram, country distribution. | "Now the important part: this is a live GBIF occurrence-search preview for the current scope. I can see matching records, records with usable coordinates, coordinate plus date coverage, where the sample points sit, and how records are distributed across years and countries." | Live GBIF occurrence-search facts, applicability. |
| 2:05-2:28 | Show datasets, basis of record, issues, coordinate uncertainty, sampling-event discovery. | "That matters because count alone is not enough. GBIF Workbench shows the shape of the evidence: datasets, basis of record, issue flags, coordinate uncertainty, and whether there is any sampling-event signal for claims that need effort or absence information." | Research fit, not vanity metrics. |
| 2:28-2:55 | Show fitness-for-use assessment and risks. | "Then it separates availability from suitability. For a range-shift question, occurrence records may be useful for exploratory mapping and data-availability scoping. But the tool is explicit about caveats, bias, and claims that are not supported by occurrence-only data." | Scientific guardrails, trust. |
| 2:55-3:28 | Show export panel tabs: R/Python, SQL/predicate, writeup, cleaning. Click GBIF.org or occurrence-search URL. | "If the question is worth pursuing, the researcher does not leave with a paragraph. They leave with a workflow: R and Python download code, a GBIF download predicate, SQL starter, cleaning script, methods text, limitations text, citation instructions, and direct links back to GBIF." | Repeatability and utility. |
| 3:28-3:45 | Click ZIP export. Then open History drawer and restore a previous analysis. | "The final step is repeatability in practice. Export the package, come back later through account history, and rerun or refine the same scoped analysis instead of losing it in a browser tab." | Workflow continuity. |
| 3:45-4:00 | Show footer non-affiliation line, then repo README or GitHub URL. | "GBIF Workbench is independent, open-source software. Try it at gbifworkbench.org, inspect the code on GitHub, and run your own GBIF-mediated occurrence question before your next download." | Openness, call to action. |

## Full Voiceover Script

Here is the problem GBIF Workbench is built for.

A researcher has a question. GBIF gives access to billions of species occurrence records. Between those two things there is usually a risky step: downloading first, then discovering later that the taxon was too broad, the date coverage was thin, the coordinates were uneven, or the claim needed abundance data that ordinary occurrence records cannot provide.

GBIF Workbench moves that check to the beginning.

I will start with a real kind of question: "I want to study climate-driven range shifts of common kingfishers, Alcedo atthis, in Europe from 1990 to 2025."

The page is public, but when I run an assessment, it asks me to sign in. That is intentional. Each signed-in researcher gets account history, and the live assessment pipeline is protected instead of being an anonymous open endpoint.

Once I submit, the tool does not jump straight to a polished answer. It first interprets the study scope: the taxon, the region, the year range, and the kind of analysis I am trying to do.

This step is practical. If the taxon is wrong, if the geography is too broad, or if the year range is not what I meant, I can edit the scope here and rerun before I treat the result as evidence.

Now GBIF Workbench fetches a live occurrence-search preview from GBIF for this exact scope.

This is the part I want researchers to have before they download. I can see how many records match, how many have coordinates, how many have usable coordinates, and how many have both coordinates and dates. I can see the sample points on a map, the record distribution by year, the country distribution, the basis of record, contributing datasets, taxonomic breakdown, GBIF issue flags, and coordinate uncertainty.

That makes the difference between "there are records" and "these records might support this study."

For this kind of range-shift question, GBIF Workbench is careful. It can say that GBIF-mediated occurrence records appear useful for exploratory spatial and temporal scoping. It can recommend filters and a reproducible download workflow. But it will also name the caveats: spatial bias, temporal bias, uneven observation effort, coordinate uncertainty, and any claims that occurrence-only data cannot support.

That restraint is the product. It does not pretend a count is a conclusion.

If the result is worth pursuing, the researcher gets the work product immediately. Here are R and Python workflows for the GBIF occurrence download. Here is the GBIF download predicate. Here is a SQL starter for occurrence-cube style summaries. Here is a cleaning pipeline, methods text, limitations text, and citation instructions.

The export package is meant to be used after the demo. It gives the researcher a path from "I have a question" to "I can request a DOI-backed GBIF occurrence download and document what I did."

And because researchers do not finish projects in one sitting, the analysis is saved to account history. I can reopen a previous result, inspect the same scope, and continue from there.

So the call to action is simple: before your next GBIF occurrence download, run the question through GBIF Workbench. Use it to catch the scope mistakes, the data-type mismatch, and the reproducibility work while the study is still cheap to change.

Try it at gbifworkbench.org. The code is open on GitHub, the exports are inspectable, and the workflow is designed around GBIF-mediated occurrence data, not around a canned demo.

## On-Screen Callouts

Use short captions only. Do not cover the app.

- Before download: check fitness-for-use
- Live GBIF occurrence-search preview
- Availability is not suitability
- Occurrence-only data cannot establish abundance trends
- Export a DOI-backed download workflow
- Restore previous analyses from account history
- Try it: gbifworkbench.org
- Source: github.com/takitajwar17/gbif-workbench

## Call To Action Rhythm

Use calls to action as part of the workflow, not as marketing breaks.

- After the question is entered: "Try the question you are actually considering, not a toy example."
- After the scope appears: "Check the interpreted scope before you trust any result."
- After the preview appears: "Look at coverage, uncertainty, issues, and datasets before you download."
- After the assessment appears: "Use the caveats to decide what claim the records can support."
- After exports appear: "Download the workflow package and request a DOI-backed GBIF occurrence download."
- At the end: "Try it at gbifworkbench.org and inspect the code on GitHub."

## What To Click During Recording

1. Open https://gbifworkbench.org/
2. Click the kingfisher demo prompt, or paste the prompt if it is not visible.
3. Click Assess study.
4. Sign in with Google if prompted.
5. Let interpreted scope appear.
6. Scroll the left pane briefly to show scope fields.
7. In the right pane, show:
   - Result overview
   - Occurrence-search preview
   - Map
   - Records by year
   - Country distribution
   - Basis of record
   - Top datasets
   - GBIF issues and flags
   - Coordinate uncertainty
   - Sampling-event discovery
8. Show the fitness-for-use assessment and risk cards.
9. Scroll to exports.
10. Click R, Python, SQL, Predicate, Methods, Limitations, and Cleaning tabs.
11. Click GBIF.org or Occurrence-search URL to show the query is not trapped inside the app.
12. Click ZIP export.
13. Open History.
14. Click a previous saved analysis to restore it.
15. End on the public app URL and GitHub repository.

## Editing Notes

Keep the pacing direct. Do not leave dead air on spinners. If an API call takes 20 seconds, show the click, show 2 or 3 seconds of progress, then cut to the returned result.

Use cursor movement deliberately:

- Point to the scope before saying "scope."
- Point to the counts before saying "matching records."
- Point to issues and uncertainty before saying "caveats."
- Point to export tabs before saying "workflow."
- Point to history before saying "come back later."

Do not zoom in so far that the app loses context. Judges should see that this is a single coherent workspace.

## If Something Times Out During Recording

The cleanest take is a successful live run. If a timeout happens, do not make the video about the error.

Use this line only if needed:

"When an optional model step takes too long, GBIF Workbench keeps the assessment usable and falls back to deterministic export text grounded in the live occurrence-search preview. That is deliberate: the researcher should not lose the work because one model call was slow."

Then click Retry analysis or cut to the successful rerun.

## Lines To Avoid

Do not say:

- "GBIF Workbench proves the study is valid."
- "This data is ready for publication."
- "This is a data-quality score."
- "The model decides the science."
- "GBIF approved this."
- "The preview creates a DOI."

Say instead:

- "fitness-for-use assessment"
- "appears useful for exploratory scoping"
- "conditioned on the live occurrence-search preview"
- "requires a DOI-backed GBIF occurrence download for reuse"
- "not affiliated with GBIF.org"
- "researcher reviews the scope and limitations"

## Short Version For A 90-Second Cut

"Before a researcher downloads GBIF-mediated occurrence records, they need to know whether the records fit the question. GBIF Workbench starts with a plain-language study idea, resolves the taxon, interprets region and years, and fetches a live GBIF occurrence-search preview. It shows record availability, usable coordinates, year and country facets, datasets, issue flags, coordinate uncertainty, and sampling-event signals. Then it gives cautious fitness-for-use guidance: what occurrence records can support, what needs caveats, and what is not supported by occurrence-only data. If the scope is worth pursuing, it exports the reproducible workflow: R, Python, SQL, GBIF download predicate, cleaning pipeline, methods, limitations, citations, notebooks, JSON, and ZIP. Sign in to save analyses and come back later. Try it at gbifworkbench.org and inspect the source at github.com/takitajwar17/gbif-workbench."

## Final Frame

Text on screen:

GBIF Workbench
Pre-download fitness-for-use for GBIF-mediated occurrence data

Try it:
https://gbifworkbench.org/

Source:
https://github.com/takitajwar17/gbif-workbench

Independent software. Not affiliated with GBIF.org.
