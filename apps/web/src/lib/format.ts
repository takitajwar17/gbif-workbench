// Pure formatters used throughout the UI. Kept in one module so any new
// formatter follows the same import convention (`from '@/lib/format'`) and
// stays testable in isolation from React components.

export function parseYearRange(value: string) {
  const match = value.match(/(18\d{2}|19\d{2}|20\d{2})\s*(?:-|to|through)?\s*(18\d{2}|19\d{2}|20\d{2})?/)
  if (!match) return null
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : new Date().getFullYear()
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

export function numberOrNull(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat().format(Math.round(value))
}

export function formatShare(value: number, total: number) {
  if (!total) return '0% of matches'
  return `${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(value / total)} of matches`
}

export function formatIssueName(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatFilterName(value: string) {
  return value.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).replace(/^./, (match) => match.toUpperCase())
}

export function formatFilterValue(value: string | number | boolean | string[]) {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function withCharset(type: string) {
  return type.includes('charset=') || type === 'application/zip' ? type : `${type};charset=utf-8`
}

export async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

export function friendlyError(message: string, fallback: string): string {
  if (!message) return fallback
  // Map common network / API errors to user-friendly copy. The order
  // matters here — more specific patterns first so they don't get
  // swallowed by the catch-all "status 5xx" branch below.
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return 'Could not reach the GBIF Workbench backend. Check your connection and try again.'
  }
  // Per-call LLM timeout — server already retried (see apps/web/server/openai.js),
  // so the user just needs to retry the analysis. We name the cause
  // (the AI service) so the user knows it's not their question.
  if (/timed out before it could complete/i.test(message)) {
    return 'The AI service took too long to respond. The backend already retried — please try the analysis again in a moment.'
  }
  // Truncated structured output after all retries exhausted — same
  // shape: server retried with a bigger token budget; ask the user to
  // try again rather than leaking parser internals.
  if (/OpenAI returned (invalid JSON|no structured output)/i.test(message)) {
    return 'The AI service returned an incomplete response after retrying. Please run the analysis again.'
  }
  if (/status 5\d\d/i.test(message)) {
    return 'The GBIF Workbench backend hit a temporary error. Please retry in a moment.'
  }
  if (/status 4\d\d/i.test(message)) {
    return `Request rejected by the backend: ${message}`
  }
  return message
}

// Human-readable labels for the AI-inferred scope fields. The intent endpoint
// returns enum values like 'species_distribution_modelling' for analysisType,
// but free-form strings (or empty strings) for spatialResolution / skillLevel.
// These helpers turn each into a presentational label the inline scope
// summary can render without re-importing ANALYSIS_OPTIONS.

const ANALYSIS_LABEL_MAP: Record<string, string> = {
  distribution_mapping: 'Distribution mapping',
  species_distribution_modelling: 'Species distribution modelling',
  range_shift_exploration: 'Range-shift exploration',
  temporal_trend_or_abundance: 'Trend / abundance triage',
  invasive_monitoring_preview: 'Invasive monitoring preview',
  unknown: 'Auto-detected',
}

export function formatAnalysisLabel(value: string | null | undefined): string {
  if (!value) return 'Auto-detected'
  return ANALYSIS_LABEL_MAP[value] ?? value.replace(/_/g, ' ')
}

export function formatSpatialLabel(value: string | null | undefined): string {
  if (!value || value === 'infer') return 'Auto-detected'
  return value
}

export function formatSkillLabel(value: string | null | undefined): string {
  if (!value || value === 'infer') return 'Auto-detected'
  const trimmed = value.trim()
  if (!trimmed) return 'Auto-detected'
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export function formatYears(start: number | null, end: number | null): string {
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} – present`
  if (end) return `– ${end}`
  return 'Any time'
}

export function formatCountries(values: string[]): string {
  if (values.length === 0) return 'Worldwide'
  if (values.length <= 6) return values.join(', ')
  return `${values.slice(0, 6).join(', ')} +${values.length - 6} more`
}