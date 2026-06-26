import { describe, it, expect } from 'vitest'
import {
  shouldRetry,
  retryDelayMs,
  escalationBudget,
  MAX_OUTPUT_TOKENS_CAP,
} from '../retryPolicy.js'

// =============================================================================
// shouldRetry
// =============================================================================

describe('shouldRetry — retryable failures', () => {
  it('retries on truncated JSON (the user-reported case)', () => {
    const error = new Error('OpenAI returned invalid JSON: Unterminated string in JSON at position 1764')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 2 })).toBe(true)
  })

  it('retries on "no structured output" (empty response)', () => {
    const error = new Error('OpenAI returned no structured output.')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(true)
  })

  it('retries on HTTP 5xx', () => {
    const error = new Error('OpenAI request failed: status 502 Bad Gateway')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(true)
    const error503 = new Error('OpenAI request failed: status 503 Service Unavailable')
    expect(shouldRetry(error503, { attemptNumber: 2, maxAttempts: 3 })).toBe(true)
  })

  it('retries on HTTP 429', () => {
    const error = new Error('OpenAI request failed: status 429 Too Many Requests')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(true)
  })

  it('retries on per-attempt timeout', () => {
    const error = new Error('OpenAI request timed out before it could complete.')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(true)
  })

  it('retries on network error', () => {
    const error = new Error('OpenAI network request failed: ECONNRESET')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(true)
  })
})

describe('shouldRetry — non-retryable failures', () => {
  it('does NOT retry on HTTP 4xx (other than 429)', () => {
    const error400 = new Error('OpenAI request failed: status 400 Bad Request')
    expect(shouldRetry(error400, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
    const error401 = new Error('OpenAI request failed: status 401 Unauthorized')
    expect(shouldRetry(error401, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
    const error403 = new Error('OpenAI request failed: status 403 Forbidden')
    expect(shouldRetry(error403, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
  })

  it('does NOT retry on missing API key', () => {
    const error = new Error('OPENAI_API_KEY is missing. Add it to apps/web/.env before running GBIF Workbench.')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
  })

  it('does NOT retry on missing-model (existing fallback-model path handles this)', () => {
    const error = new Error('OpenAI request failed: model_not_found')
    expect(shouldRetry(error, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
  })

  it('does NOT retry when out of attempts', () => {
    // Even retryable failures should NOT retry once we've exhausted attempts.
    const truncated = new Error('OpenAI returned invalid JSON: ...')
    expect(shouldRetry(truncated, { attemptNumber: 2, maxAttempts: 2 })).toBe(false)
    expect(shouldRetry(truncated, { attemptNumber: 3, maxAttempts: 3 })).toBe(false)
    expect(shouldRetry(truncated, { attemptNumber: 5, maxAttempts: 5 })).toBe(false)
  })

  it('does NOT retry on undefined / non-Error values', () => {
    expect(shouldRetry(undefined, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
    expect(shouldRetry(null, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
    expect(shouldRetry('a string', { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
    expect(shouldRetry({}, { attemptNumber: 1, maxAttempts: 3 })).toBe(false)
  })
})

// =============================================================================
// retryDelayMs
// =============================================================================

describe('retryDelayMs — exponential backoff', () => {
  it('returns baseMs on attempt 1', () => {
    expect(retryDelayMs({ attemptNumber: 1, baseMs: 1_000 })).toBe(1_000)
  })

  it('doubles on attempt 2', () => {
    expect(retryDelayMs({ attemptNumber: 2, baseMs: 1_000 })).toBe(2_000)
  })

  it('quadruples on attempt 3', () => {
    expect(retryDelayMs({ attemptNumber: 3, baseMs: 1_000 })).toBe(4_000)
  })

  it('handles baseMs = 0 (no backoff)', () => {
    expect(retryDelayMs({ attemptNumber: 1, baseMs: 0 })).toBe(0)
    expect(retryDelayMs({ attemptNumber: 3, baseMs: 0 })).toBe(0)
  })

  it('falls back to 0 for negative or NaN baseMs', () => {
    expect(retryDelayMs({ attemptNumber: 2, baseMs: -100 })).toBe(0)
    expect(retryDelayMs({ attemptNumber: 2, baseMs: NaN })).toBe(0)
    expect(retryDelayMs({ attemptNumber: 2, baseMs: Infinity })).toBe(0)
  })

  it('treats negative attemptNumber as 1 (defensive)', () => {
    expect(retryDelayMs({ attemptNumber: -1, baseMs: 1_000 })).toBe(1_000)
    expect(retryDelayMs({ attemptNumber: 0, baseMs: 1_000 })).toBe(1_000)
  })
})

// =============================================================================
// escalationBudget
// =============================================================================

describe('escalationBudget — token budget escalation', () => {
  it('attempt 1 returns the caller-requested budget unchanged', () => {
    expect(escalationBudget(4_500, 1)).toBe(4_500)
    expect(escalationBudget(12_000, 1)).toBe(12_000)
  })

  it('attempt 2 escalates by 1.5x (ceiling)', () => {
    // 4500 * 1.5 = 6750
    expect(escalationBudget(4_500, 2)).toBe(6_750)
    // 12000 * 1.5 = 18000 -> capped at MAX_OUTPUT_TOKENS_CAP
    expect(escalationBudget(12_000, 2)).toBe(MAX_OUTPUT_TOKENS_CAP)
  })

  it('attempt 3 escalates by 2x (ceiling)', () => {
    // 4500 * 2 = 9000
    expect(escalationBudget(4_500, 3)).toBe(9_000)
    // 12000 * 2 = 24000 -> capped at MAX_OUTPUT_TOKENS_CAP
    expect(escalationBudget(12_000, 3)).toBe(MAX_OUTPUT_TOKENS_CAP)
  })

  it('attempts beyond 3 stay at 2x', () => {
    expect(escalationBudget(4_500, 4)).toBe(9_000)
    expect(escalationBudget(4_500, 10)).toBe(9_000)
  })

  it('caps the budget at MAX_OUTPUT_TOKENS_CAP (including attempt 1)', () => {
    // The cap protects against runaway callers — even attempt 1 can't
    // exceed the cap. The caller shouldn't request over 16_000 anyway
    // (we default to 12_000 for workflow and 4_500 for triage), but the
    // cap is a safety net.
    expect(escalationBudget(20_000, 1)).toBe(MAX_OUTPUT_TOKENS_CAP)
    expect(escalationBudget(20_000, 2)).toBe(MAX_OUTPUT_TOKENS_CAP)
    expect(escalationBudget(20_000, 3)).toBe(MAX_OUTPUT_TOKENS_CAP)
    // 8_000 * 1.5 = 12_000 (under cap, returns 12_000)
    expect(escalationBudget(8_000, 2)).toBe(12_000)
    // 9_000 * 1.5 = 13_500 (under cap, returns 13_500)
    expect(escalationBudget(9_000, 2)).toBe(13_500)
    // 11_000 * 1.5 = 16_500 -> capped at MAX_OUTPUT_TOKENS_CAP
    expect(escalationBudget(11_000, 2)).toBe(MAX_OUTPUT_TOKENS_CAP)
  })

  it('handles missing / non-numeric input as 1', () => {
    expect(escalationBudget(undefined, 1)).toBe(1)
    expect(escalationBudget(null, 2)).toBe(2) // 1 * 1.5 = 1.5 -> ceil 2
    expect(escalationBudget('not a number', 1)).toBe(1)
  })

  it('MAX_OUTPUT_TOKENS_CAP is 16_000', () => {
    expect(MAX_OUTPUT_TOKENS_CAP).toBe(16_000)
  })
})