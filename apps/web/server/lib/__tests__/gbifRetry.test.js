import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.GBIF_RETRY_BACKOFF_MS = '0'

const { __resetGbifCacheForTests, resolveTaxon } = await import('../../gbif.js')

describe('GBIF HTTP retry behavior', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    __resetGbifCacheForTests()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('retries transient network failures before failing the analysis', async () => {
    let matchAttempts = 0
    global.fetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/species/search')) {
        return jsonResponse({ results: [] })
      }
      if (url.includes('/species/match')) {
        matchAttempts += 1
        if (matchAttempts === 1) throw new TypeError('fetch failed')
        return jsonResponse({
          usageKey: 5787213,
          scientificName: 'Panthera uncia (Schreber, 1775)',
          canonicalName: 'Panthera uncia',
          rank: 'SPECIES',
          status: 'ACCEPTED',
          confidence: 99,
          matchType: 'EXACT',
        })
      }
      throw new Error(`Unexpected GBIF URL: ${url}`)
    })

    const taxon = await resolveTaxon({
      taxonQuery: 'Panthera uncia',
      taxonText: 'snow leopard',
      taxonomicRank: 'species',
    })

    expect(matchAttempts).toBe(2)
    expect(taxon.taxonKey).toBe(5787213)
    expect(taxon.matchType).toBe('EXACT')
  })

  it('does not retry permanent client errors', async () => {
    let matchAttempts = 0
    global.fetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/species/search')) {
        return jsonResponse({ results: [] })
      }
      if (url.includes('/species/match')) {
        matchAttempts += 1
        return jsonResponse({ message: 'bad request' }, { ok: false, status: 400, statusText: 'Bad Request' })
      }
      throw new Error(`Unexpected GBIF URL: ${url}`)
    })

    await expect(resolveTaxon({
      taxonQuery: 'Panthera uncia',
      taxonText: 'snow leopard',
      taxonomicRank: 'species',
    })).rejects.toThrow(/400 Bad Request/)
    expect(matchAttempts).toBe(1)
  })
})

function jsonResponse(body, overrides = {}) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? 'OK',
    headers: {
      get: () => null,
    },
    async json() {
      return body
    },
  }
}
