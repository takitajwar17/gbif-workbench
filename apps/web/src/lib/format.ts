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
  return new Intl.NumberFormat().format(Math.round(value))
}

export function formatShare(value: number, total: number) {
  if (!total) return 'No matching records'
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