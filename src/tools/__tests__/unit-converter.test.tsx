import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitConverter } from '@/tools/unit-converter'

describe('UnitConverter', () => {
  it('renders the converter with default length category', () => {
    render(<UnitConverter />)
    expect(screen.getByText('Unit Converter')).toBeDefined()
    expect(screen.getByText('Length')).toBeDefined()
    expect(screen.getByText('Weight')).toBeDefined()
  })

  it('renders unit selectors for length', () => {
    render(<UnitConverter />)
    expect(screen.getByDisplayValue('m - Meter')).toBeDefined()
    expect(screen.getByDisplayValue('km - Kilometer')).toBeDefined()
  })

  it('switches categories when Weight is clicked', async () => {
    const user = userEvent.setup()
    render(<UnitConverter />)
    await user.click(screen.getByText('Weight'))
    expect(screen.getByDisplayValue('g - Gram')).toBeDefined()
    expect(screen.getByDisplayValue('kg - Kilogram')).toBeDefined()
  })

  it('swaps from and to units', async () => {
    const user = userEvent.setup()
    render(<UnitConverter />)
    const fromSelect = screen.getAllByRole('combobox')[0]
    const toSelect = screen.getAllByRole('combobox')[1]
    const fromValue = (fromSelect as HTMLSelectElement).value
    const toValue = (toSelect as HTMLSelectElement).value

    await user.click(screen.getByLabelText('Swap units'))

    const newFromSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    const newToSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement
    expect(newFromSelect.value).toBe(toValue)
    expect(newToSelect.value).toBe(fromValue)
  })

  it('converts 1 m to 0.001 km', () => {
    render(<UnitConverter />)
    const results = screen.getAllByText('0.001')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
