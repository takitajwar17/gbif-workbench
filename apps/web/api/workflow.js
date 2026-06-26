import { assessWorkflow } from '../server/openai.js'
import { requireUser } from '../server/auth.js'
import {
  historyDatabaseError,
  isHistoryDatabaseConfigured,
  saveHistoryEntry,
} from '../server/historyStore.js'
import { shouldUseDeterministicFallback } from '../server/lib/fallbackPolicy.js'
import { createFallbackWorkflow } from '../server/lib/fallbackWorkflow.js'
import { validatePythonCode, validateRCode } from '../server/lib/codeValidator.js'
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

  // Static parse-check on the LLM's emitted code. If R/Python aren't on
  // the server PATH (default on Vercel Hobby), codeValidator returns
  // status='skipped' and we ship unvalidated — better than failing
  // because the deploy image lacks the toolchain. If R/Python ARE
  // available and the LLM emits broken syntax, status='error' forces a
  // fall-through to the deterministic workflow so the user never gets
  // a ZIP full of code that won't parse.
  async function validateEmittedCode(workflow) {
    const [r, py] = await Promise.all([
      validateRCode(workflow.rCode),
      validatePythonCode(workflow.pythonCode),
    ])
    return { r, py }
  }

  try {
    const assessment = await assessWorkflow({ intent, taxon, query, preview, triage })
    const responseModels = { ...models, workflow: assessment.model }
    const candidateWorkflow = finalizeWorkflow(assessment.data, {
      ...payload,
      models: responseModels,
    })

    const codeCheck = await validateEmittedCode(candidateWorkflow)
    const rInvalid = codeCheck.r.status === 'error'
    const pyInvalid = codeCheck.py.status === 'error'
    if (rInvalid || pyInvalid) {
      // LLM succeeded but emitted unparseable code. Don't ship it —
      // fall through to the deterministic workflow. The deterministic
      // path's code is hand-written and known-good.
      const reasons = []
      if (rInvalid) reasons.push(`R parse failed: ${codeCheck.r.stderr}`)
      if (pyInvalid) reasons.push(`Python parse failed: ${codeCheck.py.stderr}`)
      const message = `LLM workflow code failed static parse; using deterministic fallback. ${reasons.join(' ')}`
      console.warn(`[workflow] ${message}`)
      const fallback = await buildDeterministicResponse({
        userId: user.userId,
        payload,
        intent,
        taxon,
        query,
        preview,
        triage,
        models,
        message,
      })
      res.status(200).json(fallback)
      return
    }

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
        workflow: candidateWorkflow,
        models: responseModels,
      },
    })

    res.status(200).json({
      workflow: candidateWorkflow,
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
    const fallback = await buildDeterministicResponse({
      userId: user.userId,
      payload,
      intent,
      taxon,
      query,
      preview,
      triage,
      models,
      message,
    })
    res.status(200).json(fallback)
  }
}

// Shared by two fallback paths:
//   1. AI call failed (catch block above)
//   2. AI call succeeded but emitted unparseable R/Python (validation block)
// In both cases we ship the deterministic workflow, mark the model as
// the fallback tag, and persist history so the user still sees their
// previous attempt in the history panel.
async function buildDeterministicResponse({ userId, payload, intent, taxon, query, preview, triage, models, message }) {
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
    userId,
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
  return {
    workflow,
    model: 'deterministic-workflow-fallback',
    history,
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
