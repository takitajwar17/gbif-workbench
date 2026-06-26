// Pure retry helpers used by the OpenAI structured-output call in
// `apps/web/server/openai.js`. Kept separate so they're easy to unit
// test without booting a fetch mock.
//
// The retry policy has three moving parts:
//
//   1. `shouldRetry(error, { attemptNumber, maxAttempts })` decides
//      whether the given error should trigger another attempt.
//      Distinguishes transient failures (truncated JSON, 5xx, 429,
//      network errors) from permanent ones (4xx other than 429, model
//      rejections, parse errors that aren't length-related).
//
//   2. `retryDelayMs({ attemptNumber, baseMs })` returns the
//      exponential-backoff sleep between attempts. attemptNumber 1
//      returns `baseMs`, attemptNumber 2 returns `2 * baseMs`, etc.
//      The caller sleeps before the NEXT attempt — so for 3 total
//      attempts the caller sleeps twice.
//
//   3. `escalationBudget(maxOutputTokens, attemptNumber, maxAttempts)`
//      returns the `max_output_tokens` to send on the current attempt.
//      The first attempt uses the budget the caller asked for. Later
//      attempts escalate (1.5x, 2x) up to a hard cap so the LLM has
//      more room to finish its visible output after its reasoning
//      pass.
//
// All three are pure functions — no clock, no network, no globals.

export const MAX_OUTPUT_TOKENS_CAP = 16_000

export function shouldRetry(error, { attemptNumber, maxAttempts }) {
  // Out of attempts: nothing to do.
  if (attemptNumber >= maxAttempts) return false
  if (!error || typeof error.message !== 'string') return false

  const msg = error.message

  // Truncated or empty structured output. The most common failure mode
  // with reasoning models at low effort: the model eats the output
  // budget on internal "thinking" and the visible JSON gets cut off
  // mid-string. Retrying with a larger budget fixes it most of the
  // time, so we always retry this case until we run out of attempts.
  if (/OpenAI returned invalid JSON|OpenAI returned no structured output/.test(msg)) {
    return true
  }

  // 5xx server errors and 429 rate limits from OpenAI. Transient.
  if (/status 5\d\d|status 429/i.test(msg)) return true

  // Network errors and per-attempt timeouts. Transient.
  if (/timed out before it could complete|network request failed/i.test(msg)) return true

  // Everything else (4xx other than 429, model-not-found, schema
  // rejections) is non-retryable — retrying won't help and may add
  // latency to a real bug.
  return false
}

export function retryDelayMs({ attemptNumber, baseMs }) {
  if (!Number.isFinite(baseMs) || baseMs < 0) baseMs = 0
  // Exponential backoff: baseMs, 2*baseMs, 4*baseMs, ...
  return baseMs * Math.pow(2, Math.max(0, attemptNumber - 1))
}

// Token budget for the current attempt. Reasoning models reserve part
// of `max_output_tokens` for internal thinking; when thinking consumes
// too much, the visible content is truncated. Escalating the budget
// between attempts gives the visible content more room.
//
// Attempt 1: 1x (the budget the caller asked for)
// Attempt 2: 1.5x
// Attempt 3+: 2x
// All attempts are capped at MAX_OUTPUT_TOKENS_CAP so a runaway caller
// can't ask for 50k tokens and blow the Vercel function budget.
export function escalationBudget(maxOutputTokens, attemptNumber) {
  const base = Math.max(1, Math.floor(Number(maxOutputTokens) || 0))
  const multiplier = attemptNumber <= 1 ? 1 : attemptNumber === 2 ? 1.5 : 2
  return Math.min(MAX_OUTPUT_TOKENS_CAP, Math.ceil(base * multiplier))
}