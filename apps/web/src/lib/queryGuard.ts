// Pre-flight guards for the research question. Two failure modes:
//
// 1. Prompt injection: the user pastes a string that tries to override
//    the system instructions (e.g. "ignore previous instructions and
//    …"). These are obvious to a regex and we reject them client-side
//    so no LLM token is spent, and server-side so a hand-crafted POST
//    can't bypass the UI guard.
//
// 2. Off-topic queries: the question is not about biodiversity /
//    species / GBIF occurrence data. We can't reliably detect this
//    without an LLM, so we lean on the LLM itself: the system prompt
//    instructs it to set confidence to 0 and surface a sentinel
//    ambiguity when the question is unrelated. The result is mapped
//    to a friendly rejection by the consumer of the API.
//
// Everything is pure (no React, no fetch) so the same module can be
// imported from server handlers for defense-in-depth.

export type QueryValidation =
  | { ok: true; question: string }
  | { ok: false; code: 'empty' | 'too_long' | 'prompt_injection'; message: string }

const MAX_QUESTION_LENGTH = 2000

// Patterns that strongly suggest the user is trying to override the
// system prompt or exfiltrate its contents. Conservative on purpose —
// false positives just show a slightly stricter error message; false
// negatives cost real money (an LLM call wasted on a prompt attack).
const INJECTION_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'ignore-instructions', pattern: /\b(ignore|disregard|forget|skip|override|bypass)\b[\s\S]{0,40}\b(previous|prior|above|earlier|system|original|all|the)\b[\s\S]{0,40}\b(instruction|prompt|directive|rule|context|message|guideline)/i },
  { label: 'new-system', pattern: /(^|\n)\s*(system|assistant|user)\s*:\s*[^\n]{20,}/i },
  { label: 'role-reassign', pattern: /\b(you are now|act as|pretend to be|roleplay as|behave as|be a|become a)\b[\s\S]{0,80}\b(developer|admin|root|jailbreak|DAN|unrestricted|uncensored|evil|hacker|model|chatbot|ai|assistant)\b/i },
  { label: 'system-prompt-leak', pattern: /\b(reveal|show|print|output|repeat|tell me|share|dump|leak|expose)\b[\s\S]{0,40}\b(your|the|my)\b[\s\S]{0,40}\b(system|hidden|secret|internal|original|full)\b[\s\S]{0,40}\b(prompt|instruction|message|context|rules?)\b/i },
  { label: 'instruction-tag', pattern: /<\s*\|?\s*(system|assistant|im_start|instruction|prompt)\s*\|?\s*>/i },
  { label: 'jailbreak-marker', pattern: /\b(jailbreak|DAN mode|developer mode|god mode|sudo)\b/i },
]

export function detectPromptInjection(question: string): string | null {
  const trimmed = question.trim()
  if (!trimmed) return null
  for (const { label, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) return label
  }
  return null
}

// Combined validation. Returns a discriminated union so callers can
// branch on `code` without parsing free-text error messages.
export function validateResearchQuestion(raw: string): QueryValidation {
  const question = (raw ?? '').trim()
  if (!question) {
    return {
      ok: false,
      code: 'empty',
      message: 'Type a biodiversity research question first.',
    }
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      code: 'too_long',
      message: `Research questions must be ${MAX_QUESTION_LENGTH} characters or fewer. Yours is ${question.length}.`,
    }
  }
  const injectionLabel = detectPromptInjection(question)
  if (injectionLabel) {
    return {
      ok: false,
      code: 'prompt_injection',
      message:
        'This question looks like an attempt to override GBIF Workbench instructions. ' +
        'Please rephrase as a plain biodiversity research question (e.g. where a species occurs, ' +
        'how its range is shifting, or how its GBIF records look over time).',
    }
  }
  return { ok: true, question }
}

// Sentinel ambiguity the LLM is asked to set when it can't interpret
// the question as a biodiversity / GBIF data request. The frontend
// detects this and surfaces a friendly rejection.
export const OFF_TOPIC_SENTINEL = '__off_topic_question__'

export function detectOffTopicSentinel(ambiguities: readonly string[] | undefined): boolean {
  if (!ambiguities) return false
  return ambiguities.some((entry) => entry.includes(OFF_TOPIC_SENTINEL))
}