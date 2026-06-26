import { describe, expect, it } from 'vitest'
import { validatePythonCode, validateRCode } from '../codeValidator.js'

// We don't assert the 'valid' / 'error' outcomes because they're
// environment-dependent (depends on whether Rscript / python3 are
// installed). We always assert the 'skipped' shape: when the binary is
// missing on PATH (the Vercel Hobby default), validators must return
// status='skipped' with a helpful reason rather than throw.

describe('codeValidator', () => {
  it('validatePythonCode returns a shape that always has a status field', async () => {
    const result = await validatePythonCode('print("hi")')
    expect(['valid', 'error', 'skipped']).toContain(result.status)
    // Skipped is the most common CI outcome — verify the shape if so.
    if (result.status === 'skipped') {
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('validateRCode returns a shape that always has a status field', async () => {
    const result = await validateRCode('cat("hi")')
    expect(['valid', 'error', 'skipped']).toContain(result.status)
    if (result.status === 'skipped') {
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('handles empty / null input without throwing', async () => {
    const emptyR = await validateRCode('')
    const emptyPy = await validatePythonCode('')
    const nullR = await validateRCode(null)
    const nullPy = await validatePythonCode(null)
    expect(['valid', 'error', 'skipped']).toContain(emptyR.status)
    expect(['valid', 'error', 'skipped']).toContain(emptyPy.status)
    expect(['valid', 'error', 'skipped']).toContain(nullR.status)
    expect(['valid', 'error', 'skipped']).toContain(nullPy.status)
  })

  it('never throws even for absurd inputs', async () => {
    // R parser and python compile should reject bad syntax gracefully
    // (status='error' if interpreter is present, 'skipped' if not).
    await expect(validateRCode('{{{{ not r code')).resolves.toBeDefined()
    await expect(validatePythonCode('def !!!:::')).resolves.toBeDefined()
  })
})