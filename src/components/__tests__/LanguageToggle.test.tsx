import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { LanguageToggle } from '@/components/LanguageToggle'

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

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <LanguageToggle />
    </LanguageProvider>
  )
}

describe('LanguageToggle', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders EN and VI buttons', () => {
    renderWithProvider()
    expect(screen.getByText('EN')).toBeDefined()
    expect(screen.getByText('VI')).toBeDefined()
  })

  it('highlights English by default', () => {
    renderWithProvider()
    const enButton = screen.getByText('EN')
    expect(enButton.className).toContain('shadow-sm')
  })

  it('switches to Vietnamese on VI click', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await user.click(screen.getByText('VI'))
    const viButton = screen.getByText('VI')
    expect(viButton.className).toContain('shadow-sm')
    expect(localStorageMock.getItem('language')).toBe('vi')
  })

  it('switches back to English on EN click', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await user.click(screen.getByText('VI'))
    await user.click(screen.getByText('EN'))
    expect(localStorageMock.getItem('language')).toBe('en')
  })
})
