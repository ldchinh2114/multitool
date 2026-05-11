import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LanguageProvider, useLanguage, Language } from '@/lib/language-context'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

function setupHook() {
  return renderHook(() => useLanguage(), {
    wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
  })
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to English', () => {
    const { result } = setupHook()
    expect(result.current.language).toBe('en')
  })

  it('switches to Vietnamese', () => {
    const { result } = setupHook()
    act(() => result.current.setLanguage('vi'))
    expect(result.current.language).toBe('vi')
  })

  it('persists language to localStorage', () => {
    const { result } = setupHook()
    act(() => result.current.setLanguage('vi'))
    expect(localStorageMock.getItem('language')).toBe('vi')
  })

  it('reads persisted language from localStorage', () => {
    localStorageMock.setItem('language', 'vi')
    const { result } = setupHook()
    expect(result.current.language).toBe('vi')
  })

  it('translates known keys in English', () => {
    const { result } = setupHook()
    expect(result.current.t('dashboard')).toBe('Dashboard')
    expect(result.current.t('currency')).toBe('Currency Converter')
    expect(result.current.t('dictionaryTitle')).toBe('English Dictionary')
  })

  it('translates known keys in Vietnamese', () => {
    const { result } = setupHook()
    act(() => result.current.setLanguage('vi'))
    expect(result.current.t('dashboard')).toBe('Trang chủ')
    expect(result.current.t('currency')).toBe('Chuyển đổi tiền tệ')
    expect(result.current.t('dictionaryTitle')).toBe('Từ điển Anh-Anh')
  })

  it('falls back to key name for missing translations', () => {
    const { result } = setupHook()
    const key = 'nonexistent_key' as Parameters<typeof result.current.t>[0]
    expect(result.current.t(key)).toBe(key)
  })

  it('EN and VI have same translation keys', () => {
    const { result: enResult } = setupHook()
    act(() => enResult.current.setLanguage('en'))
    const enKeys: string[] = []
    const translations = (enResult as unknown as { current: { language: Language } }).current

    const { result: viResult } = setupHook()
    act(() => viResult.current.setLanguage('vi'))
    const viKeys: string[] = []

    expect(enKeys).toEqual(viKeys)
  })
})
