import { describe, it, expect } from 'vitest'
import { friendlyError } from '../format'

// These tests lock in the mapping from raw server error strings to
// user-facing copy. The server has already done its retries before
// surfacing an error to the client, so the messages should be:
//   1) Honest about WHAT failed (so the user understands the cause).
//   2) Free of parser internals / OpenAI parameter names.
//   3) Actionable (tell the user to retry when retries are the right
//      next move).

describe('friendlyError — happy paths', () => {
  it('returns the fallback when message is empty', () => {
    expect(friendlyError('', 'fallback message')).toBe('fallback message')
    expect(friendlyError(undefined as unknown as string, 'fallback message')).toBe(
      'fallback message',
    )
  })

  it('returns the raw message when no pattern matches', () => {
    expect(friendlyError('Some unexpected error', 'fallback')).toBe('Some unexpected error')
  })
})

describe('friendlyError — network failures', () => {
  it('maps "failed to fetch" to a connection-trouble message', () => {
    const out = friendlyError('TypeError: Failed to fetch', 'fallback')
    expect(out).toMatch(/Could not reach the GBIF Workbench backend/i)
    expect(out).toMatch(/connection/i)
  })

  it('maps "network request failed" to the same connection message', () => {
    const out = friendlyError('OpenAI network request failed: ECONNRESET', 'fallback')
    expect(out).toMatch(/Could not reach the GBIF Workbench backend/i)
  })
})

describe('friendlyError — AI service timeouts', () => {
  // This is the user-reported failure: the server retried (we saw
  // "attempt 1/2 failed ... retrying in 1000ms" in the logs), the
  // second attempt also timed out, and the error bubbled up to the
  // UI as "OpenAI request timed out before it could complete." which
  // leaked OpenAI internals. The mapping should make it clear the
  // AI service was slow AND that retries already happened, so the
  // user knows to try again rather than rewrite their question.
  it('maps "OpenAI request timed out" to an AI-service-slow message', () => {
    const out = friendlyError('OpenAI request timed out before it could complete.', 'fallback')
    expect(out).toMatch(/AI service/i)
    expect(out).toMatch(/took too long/i)
    expect(out).toMatch(/already retried/i)
    expect(out).not.toMatch(/OpenAI/i) // don't leak the provider name
  })
})

describe('friendlyError — AI service incomplete responses', () => {
  it('maps truncated JSON errors to a retry-suggesting message', () => {
    const out = friendlyError(
      'OpenAI returned invalid JSON: Unterminated string in JSON at position 1764',
      'fallback',
    )
    expect(out).toMatch(/incomplete response/i)
    expect(out).toMatch(/retrying|run the analysis again/i)
    expect(out).not.toMatch(/Unterminated|JSON/i) // don't leak parser internals
  })

  it('maps empty-output errors the same way', () => {
    const out = friendlyError('OpenAI returned no structured output.', 'fallback')
    expect(out).toMatch(/incomplete response/i)
    expect(out).not.toMatch(/OpenAI|JSON/i)
  })
})

describe('friendlyError — HTTP status codes', () => {
  it('maps 5xx to a "try again" message', () => {
    expect(friendlyError('OpenAI request failed with status 502', 'fallback')).toMatch(
      /temporary error/i,
    )
    expect(friendlyError('OpenAI request failed with status 503', 'fallback')).toMatch(
      /temporary error/i,
    )
  })

  it('maps 4xx to a "rejected" message', () => {
    expect(friendlyError('status 400', 'fallback')).toMatch(/rejected/i)
    expect(friendlyError('status 401', 'fallback')).toMatch(/rejected/i)
  })
})

describe('friendlyError — pattern ordering', () => {
  // More specific patterns (timeout, truncated JSON) must win over
  // the catch-all "status 5xx" branch, otherwise the timeout message
  // would be misclassified as a generic 5xx server error.
  it('exact timeout message shape from postOpenAI AbortError routes to friendly copy', () => {
    // This is the literal message apps/web/server/openai.js throws on
    // AbortError. The friendlyError mapping must catch it.
    expect(friendlyError('OpenAI request timed out before it could complete.', 'fallback')).toMatch(
      /AI service/i,
    )
  })

  it('truncated JSON wins over 5xx for messages that contain both', () => {
    const mixed = 'OpenAI returned invalid JSON at status 502'
    expect(friendlyError(mixed, 'fallback')).toMatch(/incomplete response/i)
  })
})