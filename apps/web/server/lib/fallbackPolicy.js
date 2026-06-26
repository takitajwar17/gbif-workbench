const TRANSIENT_AI_FAILURE =
  /timed out before it could complete|network request failed|OpenAI returned invalid JSON|OpenAI returned no structured output|status 5\d\d|status 429/i

export function shouldUseDeterministicFallback(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return TRANSIENT_AI_FAILURE.test(message)
}
