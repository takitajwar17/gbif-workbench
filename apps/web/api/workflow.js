import { assessWorkflow } from '../server/openai.js'
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
  const validation = validateWorkflowBody(req.body)
  if (!validation.ok) {
    res.status(400).json({ error: validation.error })
    return
  }
  const { intent, taxon, query, preview, triage } = validation.value

  try {
    const assessment = await assessWorkflow({ intent, taxon, query, preview, triage })
    const workflow = finalizeWorkflow(assessment.data, {
      intent,
      taxon,
      query,
      preview,
      triage,
      generatedAt: new Date().toISOString(),
    })

    res.status(200).json({
      workflow,
      model: assessment.model,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'GBIF Workbench workflow generation failed.'
    console.error('[workflow]', message)
    res.status(500).json({ error: message })
  }
}