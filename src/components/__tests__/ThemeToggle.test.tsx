import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/ThemeToggle'

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

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorageMock.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the toggle button', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('defaults to light mode when no preference', () => {
    render(<ThemeToggle />)
    expect(screen.getByLabelText('Switch to dark mode')).toBeDefined()
  })

  it('toggles to dark mode on click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    expect(document.documentElement.className).toContain('dark')
    expect(localStorageMock.getItem('theme')).toBe('dark')
  })

  it('toggles back to light mode on second click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button'))
    expect(document.documentElement.className).not.toContain('dark')
    expect(localStorageMock.getItem('theme')).toBe('light')
  })

  it('respects persisted dark mode', () => {
    localStorageMock.setItem('theme', 'dark')
    render(<ThemeToggle />)
    expect(document.documentElement.className).toContain('dark')
    expect(screen.getByLabelText('Switch to light mode')).toBeDefined()
  })
})
