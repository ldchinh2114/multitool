import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { RemoveBackground } from '@/tools/remove-background'

const removeBackgroundMock = vi.fn()

vi.mock('@imgly/background-removal', () => ({
  removeBackground: (...args: unknown[]) => removeBackgroundMock(...args),
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
      <RemoveBackground />
    </LanguageProvider>
  )
}

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

describe('RemoveBackground', () => {
  let urlCounter = 0

  beforeEach(() => {
    localStorageMock.clear()
    removeBackgroundMock.mockReset()
    urlCounter = 0
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => `blob:mock-${++urlCounter}`),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the upload area by default', () => {
    renderWithProvider()
    expect(screen.getByText('Remove Background')).toBeDefined()
    expect(screen.getByText('Drag & drop an image here, or choose a file')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Choose Image' })).toBeDefined()
  })

  it('rejects non-image files', () => {
    const { container } = renderWithProvider()
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    expect(screen.getByText('Please choose an image file.')).toBeDefined()
    expect(removeBackgroundMock).not.toHaveBeenCalled()
  })

  it('removes the background and shows the result', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProvider()
    const file = new File(['fake-image'], 'photo.png', { type: 'image/png' })
    removeBackgroundMock.mockResolvedValue(new Blob(['result'], { type: 'image/png' }))

    fireEvent.change(getFileInput(container), { target: { files: [file] } })
    await user.click(screen.getByRole('button', { name: 'Remove Background' }))

    await waitFor(() => expect(removeBackgroundMock).toHaveBeenCalledTimes(1))
    expect(removeBackgroundMock.mock.calls[0][0]).toBe(file)

    expect(await screen.findByRole('heading', { name: 'Result' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDefined()
  })

  it('shows an error message when removal fails', async () => {
    const user = userEvent.setup()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderWithProvider()
    const file = new File(['fake-image'], 'photo.png', { type: 'image/png' })
    removeBackgroundMock.mockRejectedValue(new Error('boom'))

    fireEvent.change(getFileInput(container), { target: { files: [file] } })
    await user.click(screen.getByRole('button', { name: 'Remove Background' }))

    expect(
      await screen.findByText(
        'Could not remove the background. Please check your internet connection and try again.'
      )
    ).toBeDefined()
    errorSpy.mockRestore()
  })
})
