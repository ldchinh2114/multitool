import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { Header } from '@/components/Header'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

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
      <Header />
    </LanguageProvider>
  )
}

describe('Header', () => {
  beforeEach(() => {
    localStorageMock.clear()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the logo with home link', () => {
    renderWithProvider()
    const homeLink = screen.getByText('Multi-Tool Hub')
    expect(homeLink).toBeDefined()
    expect(homeLink.closest('a')?.getAttribute('href')).toBe('/')
  })

  it('renders navigation links', () => {
    renderWithProvider()
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Currency Converter')).toBeDefined()
    expect(screen.getByText('Dictionary')).toBeDefined()
    expect(screen.getByText('Unit Converter')).toBeDefined()
  })

  it('renders LanguageToggle and ThemeToggle', () => {
    renderWithProvider()
    expect(screen.getByText('EN')).toBeDefined()
    expect(screen.getByText('VI')).toBeDefined()
    expect(screen.getByLabelText('Switch to dark mode')).toBeDefined()
  })

  it('has a mobile menu button on small screens', () => {
    renderWithProvider()
    expect(screen.getByLabelText('Toggle menu')).toBeDefined()
  })

  it('opens mobile menu on hamburger click', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await user.click(screen.getByLabelText('Toggle menu'))
    expect(screen.getByText('Multi-Tool Hub Home')).toBeDefined()
  })

  it('closes mobile menu on second hamburger click', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await user.click(screen.getByLabelText('Toggle menu'))
    await user.click(screen.getByLabelText('Toggle menu'))
    expect(screen.queryByText('Multi-Tool Hub Home')).toBeNull()
  })
})
