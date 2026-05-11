import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/lib/language-context'
import { Dashboard } from '@/components/Dashboard'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

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
      <Dashboard />
    </LanguageProvider>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the hero section', () => {
    renderWithProvider()
    expect(screen.getByText('All-in-One Online Tools')).toBeDefined()
  })

  it('renders tool cards', () => {
    renderWithProvider()
    expect(screen.getByText('Currency Converter')).toBeDefined()
    expect(screen.getByText('Dictionary')).toBeDefined()
    expect(screen.getByText('Unit Converter')).toBeDefined()
    expect(screen.getByText('Resume Builder')).toBeDefined()
  })

  it('renders features section', () => {
    renderWithProvider()
    expect(screen.getByText('Lightning Fast')).toBeDefined()
    expect(screen.getByText('Privacy First')).toBeDefined()
    expect(screen.getByText('Mobile Friendly')).toBeDefined()
  })

  it('tool cards link to correct paths', () => {
    renderWithProvider()
    const currencyLink = screen.getByText('Currency Converter').closest('a')
    expect(currencyLink?.getAttribute('href')).toBe('/tools/currency')

    const resumeLink = screen.getByText('Resume Builder').closest('a')
    expect(resumeLink?.getAttribute('href')).toBe('/tools/resume-builder')
  })
})
