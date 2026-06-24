const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export function countryLabel(code: string) {
  const normalized = code.trim().toUpperCase()
  const label = regionNames?.of(normalized)
  return label && label !== 'Unknown Region' ? label : normalized
}

export function parseCountryList(input: string): string[] {
  return [...new Set(input.split(/[,\s]+/).map((part) => part.trim().toUpperCase()).filter((part) => /^[A-Z]{2}$/.test(part)))]
}
