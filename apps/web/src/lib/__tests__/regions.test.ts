import { describe, expect, it } from 'vitest'
import { countryLabel, parseCountryList } from '../regions'

describe('country helpers', () => {
  it('normalizes editable ISO country-code lists', () => {
    expect(parseCountryList('bd, IN th BD invalid')).toEqual(['BD', 'IN', 'TH'])
  })

  it('formats country codes without a bundled lookup table', () => {
    expect(countryLabel('BD')).toBe('Bangladesh')
    expect(countryLabel('zz')).toBe('ZZ')
  })
})
