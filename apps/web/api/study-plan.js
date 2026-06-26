import { assessTriage, interpretStudyIntent } from '../server/openai.js'
import {
  buildGbifQuery,
  normalizeIntent,
  previewGbifData,
  resolveTaxon,
} from '../server/gbif.js'
import {
  createFallbackTriage,
} from '../server/lib/fallbackTriage.js'
import { shouldUseDeterministicFallback } from '../server/lib/fallbackPolicy.js'
import {
  normalizeTriage,
  seedIntentFromOverrides,
  validateStudyPlanBody,
} from '../server/workflow.js'

// Vercel Node.js serverless function: POST /api/study-plan
//
// Returns intent + taxon + query + preview + triage. This is the FAST
// half of the old combined endpoint — the heavy workflow code + report
// generation now lives behind /api/workflow so each call stays under
// the Vercel Hobby 60s ceiling.
//
// The previous combined endpoint routinely timed out because the
// single LLM call had to produce both the triage qualitative labels
// AND the long-form R/Python/markdown/html output in one structured
// response. Splitting lets the user see the result card immediately
// while /api/workflow streams the code/report in behind it.
export default async function handler(req, res) {
  const validation = validateStudyPlanBody(req.body)
  if (!validation.ok) {
    res.status(400).json({ error: validation.error })
    return
  }
  const { question, overrides } = validation.value

  try {
    // Start the LLM intent interpretation in parallel with a seed GBIF taxon
    // resolution that uses the user's draft overrides (taxon text + rank only).
    // If the LLM later rewrites the taxon, we re-resolve against the GBIF
    // Backbone. This overlaps the slowest single call (LLM) with a fast GBIF
    // round trip when the user has typed a concrete taxon name.
    const [interpreted, seedTaxon] = await Promise.all([
      interpretStudyIntent({ question, overrides }),
      resolveTaxon(seedIntentFromOverrides(overrides)),
    ])
    const intent = normalizeIntent(interpreted.data)
    const seedName = String(seedTaxon.sourceName || '').trim().toLowerCase()
    const llmName = String(intent.taxonQuery || intent.taxonText || '')
      .trim()
      .toLowerCase()
    // If the LLM produced a taxon name that differs from the seed (including
    // the empty-seed case where the user did not fill the draft taxon field),
    // re-resolve against the GBIF Backbone so downstream steps use the
    // LLM-chosen canonical name.
    const taxon =
      llmName && seedName !== llmName ? await resolveTaxon(intent) : seedTaxon
    const query = buildGbifQuery(intent, taxon)
    const preview = await previewGbifData(intent, query)
    let triage
    let triageModel
    try {
      const assessment = await assessTriage({ intent, taxon, query, preview })
      triage = normalizeTriage(assessment.data, intent, preview)
      triageModel = assessment.model
    } catch (error) {
      if (!shouldUseDeterministicFallback(error)) throw error
      const message = error instanceof Error ? error.message : 'AI triage failed.'
      console.warn(`[study-plan] AI triage unavailable; using deterministic fallback: ${message}`)
      triage = normalizeTriage(
        createFallbackTriage({ intent, taxon, preview, reason: message }),
        intent,
        preview,
      )
      triageModel = 'deterministic-preview-fallback'
    }

    res.status(200).json({
      intent,
      taxon,
      query,
      preview,
      triage,
      models: {
        intent: interpreted.model,
        triage: triageModel,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'GBIF Workbench analysis failed.'
    console.error('[study-plan]', message)
    res.status(500).json({ error: message })
  }
}
