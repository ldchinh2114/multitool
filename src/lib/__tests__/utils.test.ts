import { describe, it, expect, vi } from 'vitest'
import { formatCurrency, formatTimestamp, isValidWord, fetchWithErrorHandling, debounce } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    const result = formatCurrency(1234.56, 'USD')
    expect(result).toContain('$')
    expect(result).toContain('1,234')
  })

  it('formats VND correctly', () => {
    const result = formatCurrency(10000, 'VND')
    expect(result).toContain('10')
  })

  it('formats zero amount', () => {
    const result = formatCurrency(0, 'USD')
    expect(result).toContain('$0')
  })
})

describe('formatTimestamp', () => {
  it('formats a valid timestamp', () => {
    const result = formatTimestamp('2024-01-15T10:30:00Z')
    expect(result).toContain('2024')
    expect(result).toContain('Jan')
  })

  it('handles different timestamps', () => {
    const result = formatTimestamp('2023-12-25T00:00:00Z')
    expect(result).toContain('Dec')
  })
})

describe('isValidWord', () => {
  it('returns true for valid words', () => {
    expect(isValidWord('hello')).toBe(true)
    expect(isValidWord('Hello')).toBe(true)
  })

  it('returns false for empty strings', () => {
    expect(isValidWord('')).toBe(false)
  })

  it('returns false for strings with numbers', () => {
    expect(isValidWord('hello123')).toBe(false)
  })

  it('returns false for whitespace only', () => {
    expect(isValidWord('   ')).toBe(false)
  })
})

describe('fetchWithErrorHandling', () => {
  it('returns JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'ok' }),
    } as Response)

    const result = await fetchWithErrorHandling<{ data: string }>('/api/test')
    expect(result).toEqual({ data: 'ok' })
  })

  it('throws on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(fetchWithErrorHandling('/api/test')).rejects.toThrow('Not found')
  })

  it('throws on 500 with status code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    await expect(fetchWithErrorHandling('/api/test')).rejects.toThrow('HTTP error! status: 500')
  })
})

describe('debounce', () => {
  it('calls function after wait period', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 50)

    debounced()
    debounced()
    debounced()

    expect(fn).not.toHaveBeenCalled()

    await new Promise((r) => setTimeout(r, 100))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes arguments correctly', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 50)

    debounced('arg1', 'arg2')
    await new Promise((r) => setTimeout(r, 100))
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })
})
