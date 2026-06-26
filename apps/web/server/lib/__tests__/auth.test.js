import { describe, expect, it, afterEach } from 'vitest'
import { getBearerToken, parseAuthorizedParties, requireUser } from '../../auth.js'

const originalSecret = process.env.CLERK_SECRET_KEY

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CLERK_SECRET_KEY
  } else {
    process.env.CLERK_SECRET_KEY = originalSecret
  }
})

describe('getBearerToken', () => {
  it('extracts a bearer token from request headers', () => {
    expect(getBearerToken({ headers: { authorization: 'Bearer session-token' } })).toBe('session-token')
    expect(getBearerToken({ headers: { Authorization: 'bearer another-token' } })).toBe('another-token')
  })

  it('returns an empty string for missing or non-bearer auth headers', () => {
    expect(getBearerToken({ headers: {} })).toBe('')
    expect(getBearerToken({ headers: { authorization: 'Basic abc' } })).toBe('')
  })
})

describe('parseAuthorizedParties', () => {
  it('parses comma-separated origins', () => {
    expect(parseAuthorizedParties('https://example.org, http://localhost:5173 ,,')).toEqual([
      'https://example.org',
      'http://localhost:5173',
    ])
  })
})

describe('requireUser', () => {
  it('fails closed when Clerk server credentials are missing', async () => {
    delete process.env.CLERK_SECRET_KEY
    const response = createResponse()

    await expect(requireUser({ headers: { authorization: 'Bearer token' } }, response)).resolves.toBeNull()
    expect(response.statusCode).toBe(500)
    expect(response.body.error).toMatch(/Authentication is not configured/)
  })
})

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(value) {
      this.body = value
      return this
    },
  }
}
