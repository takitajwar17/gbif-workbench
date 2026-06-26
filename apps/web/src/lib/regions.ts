const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

// ISO-3166 alpha-2 country code format. Hoisted to module scope so
// `parseCountryList` and any other consumers don't allocate a fresh
// regex on every call.
// See: js-hoist-regexp in the Vercel React Best Practices.
const ISO_COUNTRY_CODE = /^[A-Z]{2}$/
const INPUT_DELIMITERS = /[,\s]+/

export function countryLabel(code: string) {
  const normalized = code.trim().toUpperCase()
  const label = regionNames?.of(normalized)
  return label && label !== 'Unknown Region' ? label : normalized
}

export function parseCountryList(input: string): string[] {
  return [...new Set(input.split(INPUT_DELIMITERS).map((part) => part.trim().toUpperCase()).filter((part) => ISO_COUNTRY_CODE.test(part)))]
}
