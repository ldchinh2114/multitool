import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { CurrencyConverter } from '@/tools/currency-converter'

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

const mockRates = {
  rates: {
    USD: 1,
    VND: 25400,
    EUR: 0.92,
    JPY: 150,
    GBP: 0.79,
    CNY: 7.24,
    KRW: 1350,
    HKD: 7.82,
    TWD: 32.15,
  },
}

function getSelectValues(): string[] {
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
  return selects.map((s) => s.value)
}

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <CurrencyConverter />
    </LanguageProvider>
  )
}

describe('CurrencyConverter', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockRates,
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    renderWithProvider()
    expect(screen.getByText('Loading exchange rates...')).toBeDefined()
  })

  it('renders converter UI with selects after loading', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByText('Currency Converter')).toBeDefined()
    }, { timeout: 5000 })

    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBe(2)
    expect((selects[0] as HTMLSelectElement).value).toBe('USD')
    expect((selects[1] as HTMLSelectElement).value).toBe('VND')
  })

  it('displays error state when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByText('Error Loading Rates')).toBeDefined()
    }, { timeout: 5000 })
  })

  it('swaps from and to currencies', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByText('Currency Converter')).toBeDefined()
    }, { timeout: 5000 })

    expect(getSelectValues()).toEqual(['USD', 'VND'])

    await user.click(screen.getByLabelText('Swap currencies'))
    expect(getSelectValues()).toEqual(['VND', 'USD'])
  })

  it('shows result after loading rates', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByText('Exchange Rate')).toBeDefined()
    }, { timeout: 5000 })
  })

  it('renders quick reference section', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByText('Quick Reference (1 USD)')).toBeDefined()
    }, { timeout: 5000 })
  })
})
