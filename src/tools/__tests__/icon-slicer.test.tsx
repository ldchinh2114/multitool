import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { IconSlicer } from '@/tools/icon-slicer'

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

// jsdom không có canvas/Path2D thật: stub 2D context và toBlob để luồng xuất ảnh chạy được.
const contextStub = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  clip: vi.fn(),
  imageSmoothingEnabled: true,
}

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <IconSlicer />
    </LanguageProvider>
  )
}

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

function uploadImage(
  container: HTMLElement,
  file = new File(['fake-image'], 'full-icon.png', { type: 'image/png' }),
  width = 120,
  height = 80
) {
  fireEvent.change(getFileInput(container), { target: { files: [file] } })
  const image = container.querySelector('img') as HTMLImageElement
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height })
  fireEvent.load(image)
  return image
}

function drawRect(
  surface: HTMLElement,
  from: [number, number],
  to: [number, number],
  pointerId = 1
) {
  fireEvent.pointerDown(surface, {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    clientX: from[0],
    clientY: from[1],
  })
  fireEvent.pointerMove(surface, {
    pointerId,
    pointerType: 'mouse',
    clientX: to[0],
    clientY: to[1],
  })
  fireEvent.pointerUp(surface, {
    pointerId,
    pointerType: 'mouse',
    clientX: to[0],
    clientY: to[1],
  })
}

describe('IconSlicer', () => {
  beforeEach(() => {
    localStorageMock.clear()
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => contextStub),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback) =>
        callback(new Blob(['png'], { type: 'image/png' })),
    })
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2)}`),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })
    // jsdom không thực hiện được việc "tải" thật, chỉ cần chặn cú click
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the upload area by default', () => {
    renderWithProvider()
    expect(screen.getByRole('heading', { name: 'Icon Slicer' })).toBeDefined()
    expect(screen.getByText('Drag & drop an image here, or choose a file')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Choose Image' })).toBeDefined()
  })

  it('rejects files that are not supported images', () => {
    const { container } = renderWithProvider()
    const file = new File(['<svg />'], 'icons.svg', { type: 'image/svg+xml' })

    fireEvent.change(getFileInput(container), { target: { files: [file] } })

    expect(screen.getByText('Please choose a PNG, JPG, WEBP, GIF, BMP or AVIF image.')).toBeDefined()
    expect(screen.queryByTestId('slicer-surface')).toBeNull()
  })

  it('shows the drawing toolbar once an image is loaded', () => {
    const { container } = renderWithProvider()
    uploadImage(container)

    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Freehand' })).toBeDefined()
    expect(screen.getByText('120 × 80 px')).toBeDefined()
    expect(
      screen.getByText('No slices yet. Draw a box or trace around each icon to cut it out.')
    ).toBeDefined()
  })

  it('creates a numbered slice from a rectangle drag', () => {
    const { container } = renderWithProvider()
    uploadImage(container)

    drawRect(screen.getByTestId('slicer-surface'), [10, 10], [50, 30])

    expect(screen.getByText('1.png')).toBeDefined()
    expect(screen.getByText('40 × 20 px')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeDefined()
  })

  it('numbers slices in the order they are drawn', () => {
    const { container } = renderWithProvider()
    uploadImage(container)
    const surface = screen.getByTestId('slicer-surface')

    drawRect(surface, [10, 10], [40, 40], 1)
    drawRect(surface, [60, 10], [90, 40], 2)

    expect(screen.getByText('1.png')).toBeDefined()
    expect(screen.getByText('2.png')).toBeDefined()
  })

  it('deletes a slice and restores it with undo', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProvider()
    uploadImage(container)
    const surface = screen.getByTestId('slicer-surface')

    drawRect(surface, [10, 10], [40, 40], 1)
    drawRect(surface, [60, 10], [90, 40], 2)

    await user.click(screen.getAllByLabelText('Delete slice')[0])
    expect(screen.getAllByLabelText('Delete slice')).toHaveLength(1)
    expect(screen.queryByText('2.png')).toBeNull()

    await user.click(screen.getByLabelText('Undo'))
    expect(screen.getAllByLabelText('Delete slice')).toHaveLength(2)
    expect(screen.getByText('2.png')).toBeDefined()
  })

  it('follows the file name pattern and start number', () => {
    const { container } = renderWithProvider()
    uploadImage(container)

    drawRect(screen.getByTestId('slicer-surface'), [10, 10], [40, 40])

    fireEvent.change(screen.getByLabelText('File name pattern'), {
      target: { value: 'icon-{n}' },
    })
    fireEvent.change(screen.getByLabelText('Start number'), { target: { value: '5' } })

    expect(screen.getByText('icon-5.png')).toBeDefined()
  })

  it('downloads every slice in a single zip', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProvider()
    uploadImage(container)
    const surface = screen.getByTestId('slicer-surface')

    drawRect(surface, [10, 10], [40, 40], 1)
    drawRect(surface, [60, 10], [90, 40], 2)

    const createObjectURL = URL.createObjectURL as unknown as ReturnType<typeof vi.fn>
    createObjectURL.mockClear()

    await user.click(screen.getByRole('button', { name: 'Download ZIP' }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/zip')
  })
})
