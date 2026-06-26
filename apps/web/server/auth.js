import './env.js'
import { verifyToken } from '@clerk/backend'

export function getBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || ''
  const value = Array.isArray(header) ? header[0] : header
  const match = String(value).match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

export function parseAuthorizedParties(value = process.env.CLERK_AUTHORIZED_PARTIES || '') {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function requireUser(req, res) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    res.status(500).json({
      error: 'Authentication is not configured. Add CLERK_SECRET_KEY before running protected GBIF Workbench API routes.',
    })
    return null
  }

  const token = getBearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Sign in to run GBIF Workbench analysis.' })
    return null
  }

  try {
    const authorizedParties = parseAuthorizedParties()
    const payload = await verifyToken(token, {
      secretKey,
      authorizedParties: authorizedParties.length ? authorizedParties : undefined,
    })
    return {
      userId: payload.sub,
      sessionId: typeof payload.sid === 'string' ? payload.sid : null,
    }
  } catch {
    res.status(401).json({ error: 'Your sign-in session could not be verified. Sign in again and retry.' })
    return null
  }
}
