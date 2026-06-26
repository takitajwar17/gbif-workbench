import { assessWorkflow } from '../server/openai.js'
import { requireUser } from '../server/auth.js'
import {
  historyDatabaseError,
  isHistoryDatabaseConfigured,
  saveHistoryEntry,
} from '../server/historyStore.js'
import { shouldUseDeterministicFallback } from '../server/lib/fallbackPolicy.js'
import { createFallbackWorkflow } from '../server/lib/fallbackWorkflow.js'
import { finalizeWorkflow, validateWorkflowBody } from '../server/workflow.js'

// Vercel Node.js serverless function: POST /api/workflow
//
// Returns the long-form reproducible code, methods text, reports, and
// other workflow-package fields. This is the SLOW half of the old
// combined endpoint — it lives separately so it gets its own 60s
// budget and so the user sees the result card immediately while the
// workflow streams in.
//
// Inputs are the already-resolved intent / taxon / query / preview
// from /api/study-plan. We do NOT re-resolve the taxon or re-fetch the
// GBIF preview here — both are deterministic functions of the inputs
// and we trust the caller to send the same shapes /api/study-plan
// produced.
//
// `triage` is optional but recommended: when present, the LLM can
// echo its qualitative judgments (support headline, risks, recommended
// filters) into the markdown/html report instead of inventing its own.
export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  const validation = validateWorkflowBody(req.body)
  if (!validation.ok) {
    res.status(400).json({ error: validation.error })
    return
  }
  const { intent, taxon, query, preview, triage, models } = validation.value

  const payload = {
    intent,
    taxon,
    query,
    preview,
    triage,
    models,
    generatedAt: new Date().toISOString(),
  }

  try {
    const assessment = await assessWorkflow({ intent, taxon, query, preview, triage })
    const responseModels = { ...models, workflow: assessment.model }
    const workflow = finalizeWorkflow(assessment.data, {
      ...payload,
      models: responseModels,
    })
    const history = await saveWorkflowHistory({
      userId: user.userId,
      snapshot: {
        question: intent.question,
        preferredLanguage: intent.preferredLanguage,
        intent,
        taxon,
        query,
        preview,
        triage,
        workflow,
        models: responseModels,
      },
    })

    res.status(200).json({
      workflow,
      model: assessment.model,
      history,
    })
  } catch (error) {
    if (!shouldUseDeterministicFallback(error)) {
      const message =
        error instanceof Error
          ? error.message
          : 'GBIF Workbench workflow generation failed.'
      console.error('[workflow]', message)
      res.status(500).json({ error: message })
      return
    }

    const message = error instanceof Error ? error.message : 'AI workflow failed.'
    console.warn(`[workflow] AI workflow unavailable; using deterministic fallback: ${message}`)
    const responseModels = { ...models, workflow: 'deterministic-workflow-fallback' }
    const workflow = finalizeWorkflow(createFallbackWorkflow({
      intent,
      taxon,
      query,
      preview,
      triage,
      reason: message,
    }), {
      ...payload,
      models: responseModels,
    })
    const history = await saveWorkflowHistory({
      userId: user.userId,
      snapshot: {
        question: intent.question,
        preferredLanguage: intent.preferredLanguage,
        intent,
        taxon,
        query,
        preview,
        triage,
        workflow,
        models: responseModels,
      },
    })

    res.status(200).json({
      workflow,
      model: 'deterministic-workflow-fallback',
      history,
    })
  }
}

async function saveWorkflowHistory({ userId, snapshot }) {
  if (!isHistoryDatabaseConfigured()) {
    return { saved: false, reason: historyDatabaseError().message }
  }

  try {
    const item = await saveHistoryEntry({ userId, snapshot })
    return { saved: true, item }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'History save failed.'
    console.warn(`[workflow] History save unavailable: ${message}`)
    return { saved: false, reason: message }
  }
}
