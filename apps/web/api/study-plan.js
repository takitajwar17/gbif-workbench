import { assessStudy, interpretStudyIntent } from '../server/openai.js'
import {
  buildGbifQuery,
  normalizeIntent,
  previewGbifData,
  resolveTaxon,
} from '../server/gbif.js'
import {
  finalizeWorkflow,
  normalizeTriage,
  seedIntentFromOverrides,
  validateStudyPlanBody,
} from '../server/workflow.js'

// Vercel Node.js serverless function: POST /api/study-plan
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
    const assessment = await assessStudy({ intent, taxon, query, preview })
    const triage = normalizeTriage(assessment.data.triage, intent, preview)
    const workflow = finalizeWorkflow(assessment.data.workflow, {
      intent,
      taxon,
      query,
      preview,
      triage,
      models: {
        intent: interpreted.model,
        assessment: assessment.model,
      },
      generatedAt: new Date().toISOString(),
    })

    res.status(200).json({
      intent,
      taxon,
      query,
      preview,
      triage,
      workflow,
      models: {
        intent: interpreted.model,
        assessment: assessment.model,
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