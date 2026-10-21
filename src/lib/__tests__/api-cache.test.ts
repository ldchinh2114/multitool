import { describe, it, expect, beforeEach } from 'vitest'
import { readCache, writeCache, removeCache } from '@/lib/api-cache'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (_i: number) => null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('api-cache', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('returns null for a missing key', () => {
    expect(readCache('nope', 1000)).toBeNull()
  })

  it('round-trips a value', () => {
    writeCache('rates', { usd: 1 })
    expect(readCache('rates', 1000)).toEqual({ usd: 1 })
  })

  it('returns null once the value is older than the ttl', () => {
    writeCache('rates', { usd: 1 })
    expect(readCache('rates', 0)).toBeNull()
  })

  it('removes a cached value', () => {
    writeCache('rates', { usd: 1 })
    removeCache('rates')
    expect(readCache('rates', 1000)).toBeNull()
  })

  it('survives a corrupted entry', () => {
    window.localStorage.setItem('kitbag-cache:broken', 'not json')
    expect(readCache('broken', 1000)).toBeNull()
  })

  it('does not throw when storage rejects the write', () => {
    const original = window.localStorage.setItem
    window.localStorage.setItem = () => { throw new Error('QuotaExceededError') }
    expect(() => writeCache('big', { a: 1 })).not.toThrow()
    window.localStorage.setItem = original
  })
})
