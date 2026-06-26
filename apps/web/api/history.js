import { requireUser } from '../server/auth.js'
import {
  deleteHistoryEntry,
  getHistoryEntry,
  historyDatabaseError,
  isHistoryDatabaseConfigured,
  listHistoryEntries,
} from '../server/historyStore.js'

// Vercel Node.js serverless function: GET/DELETE /api/history
export default async function handler(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  if (!isHistoryDatabaseConfigured()) {
    res.status(503).json({ error: historyDatabaseError().message })
    return
  }

  try {
    if (req.method === 'GET') {
      const id = getQueryValue(req, 'id')
      if (id) {
        const item = await getHistoryEntry({ userId: user.userId, id })
        if (!item) {
          res.status(404).json({ error: 'History entry was not found.' })
          return
        }
        res.status(200).json({ item })
        return
      }

      const limit = getQueryValue(req, 'limit')
      const items = await listHistoryEntries({ userId: user.userId, limit })
      res.status(200).json({ items })
      return
    }

    if (req.method === 'DELETE') {
      const id = getQueryValue(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'History entry id is required.' })
        return
      }

      const deleted = await deleteHistoryEntry({ userId: user.userId, id })
      if (!deleted) {
        res.status(404).json({ error: 'History entry was not found.' })
        return
      }
      res.status(200).json({ ok: true })
      return
    }

    res.setHeader('Allow', 'GET, DELETE')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'History request failed.'
    console.error('[history]', message)
    res.status(500).json({ error: message })
  }
}

function getQueryValue(req, key) {
  const value = req.query?.[key]
  if (Array.isArray(value)) return value[0] || ''
  if (typeof value === 'string') return value

  try {
    const url = new URL(req.url || '', 'http://local')
    return url.searchParams.get(key) || ''
  } catch {
    return ''
  }
}
