import { interpretStudyIntent } from '../server/openai.js'
import { requireUser } from '../server/auth.js'
import { normalizeIntent } from '../server/gbif.js'
import { validateParseIntentBody } from '../server/workflow.js'

// Vercel Node.js serverless function: POST /api/parse-intent
export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  const validation = validateParseIntentBody(req.body)
  if (!validation.ok) {
    res.status(400).json({ error: validation.error })
    return
  }
  const { question, overrides } = validation.value
  try {
    const interpreted = await interpretStudyIntent({ question, overrides })
    res.status(200).json({
      intent: normalizeIntent(interpreted.data),
      model: interpreted.model,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'GBIF Workbench interpretation failed.'
    console.error('[parse-intent]', message)
    res.status(500).json({ error: message })
  }
}
