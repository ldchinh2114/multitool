import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  normalizeDictionaryResponse,
  getCachedWordDetails,
  setCachedWordDetails,
  loadWordDetails,
  type WordDetailsData,
} from '@/lib/dictionary'

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

const rawResponse = {
  word: 'hello',
  entries: [
    {
      partOfSpeech: 'interjection',
      pronunciations: [{ type: 'ipa', text: '/hɛˈloʊ/' }],
      senses: [{ definition: 'A greeting.', examples: ['Hello, everyone.'] }],
      synonyms: ['hi'],
      antonyms: ['goodbye'],
    },
  ],
}

describe('dictionary', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('normalizeDictionaryResponse', () => {
    it('maps the API payload onto the app shape', () => {
      const result = normalizeDictionaryResponse(rawResponse)
      expect(result?.word).toBe('hello')
      expect(result?.phonetic).toBe('/hɛˈloʊ/')
      expect(result?.phonetics[0].text).toBe('/hɛˈloʊ/')
      expect(result?.meanings[0].partOfSpeech).toBe('interjection')
      expect(result?.meanings[0].definitions[0].definition).toBe('A greeting.')
      expect(result?.meanings[0].definitions[0].example).toBe('Hello, everyone.')
    })

    it('returns null when there is no usable entry', () => {
      expect(normalizeDictionaryResponse(null)).toBeNull()
      expect(normalizeDictionaryResponse({ word: 'x', entries: [] })).toBeNull()
      expect(normalizeDictionaryResponse({ entries: [{ senses: [] }] })).toBeNull()
    })
  })

  describe('word details cache', () => {
    const details: WordDetailsData = {
      entry: null,
      synonyms: ['hi'],
      antonyms: ['bye'],
      fallbackMeanings: [],
    }

    it('stores and reads a word case-insensitively', () => {
      setCachedWordDetails('Hello', details)
      expect(getCachedWordDetails('hello')?.synonyms).toEqual(['hi'])
      expect(getCachedWordDetails('HELLO')?.antonyms).toEqual(['bye'])
    })

    it('returns undefined for an unknown word', () => {
      expect(getCachedWordDetails('nothing')).toBeUndefined()
    })

    it('keeps at most 60 words', () => {
      for (let i = 0; i < 70; i++) setCachedWordDetails(`word${i}`, details)
      expect(getCachedWordDetails('word69')).toBeDefined()
      expect(getCachedWordDetails('word0')).toBeUndefined()
    })
  })

  describe('loadWordDetails', () => {
    it('reports each section as it resolves', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => rawResponse,
      } as Response)

      const patches: Partial<WordDetailsData>[] = []
      const result = await loadWordDetails('hello', new AbortController().signal, (p) => patches.push(p))

      expect(result.entry?.word).toBe('hello')
      expect(patches.length).toBeGreaterThan(0)
      expect(patches.some((p) => p.entry !== undefined)).toBe(true)
    })

    it('degrades to empty sections when the API fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

      const result = await loadWordDetails('hello', new AbortController().signal)

      expect(result.entry).toBeNull()
      expect(result.synonyms).toEqual([])
      expect(result.antonyms).toEqual([])
      expect(result.fallbackMeanings).toEqual([])
    })
  })
})
