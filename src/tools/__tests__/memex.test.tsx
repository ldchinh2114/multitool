import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { Memex } from '@/tools/memex'
import { MEMEX_STORAGE_KEY } from '@/lib/memex'
import {
  createPlaintextMemexFile,
  encryptMemexFile,
  serialiseMemexFile,
} from '@/lib/memex-crypto'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (_i: number) => Object.keys(store)[_i] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <Memex />
    </LanguageProvider>
  )
}

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

/** The toolbar "New Note" button. The empty state renders a second one. */
function newNoteButton() {
  return screen.getAllByRole('button', { name: 'New Note' })[0]
}

/** The toolbar "New Folder" button. The empty state renders a second one. */
function newFolderButton() {
  return screen.getAllByRole('button', { name: 'New Folder' })[0]
}

/** A button inside the most recently opened dialog. */
function dialogButton(name: string) {
  const dialogs = screen.getAllByRole('dialog')
  const dialog = dialogs[dialogs.length - 1]
  return within(dialog).getByRole('button', { name })
}

/** The Blob handed to `URL.createObjectURL` by the export helper. */
let capturedBlob: Blob | null = null

/** The `download` attribute of the anchor the export helper clicked. */
let capturedDownloadName: string | null = null

describe('Memex', () => {
  beforeEach(() => {
    localStorageMock.clear()
    capturedBlob = null
    capturedDownloadName = null

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn((blob: Blob) => {
        capturedBlob = blob
        return 'blob:mock'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })

    // jsdom cannot navigate to a blob URL, so the download click is stubbed.
    // The blob itself is captured through `URL.createObjectURL` above, and the
    // file name through the anchor's `download` attribute.
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      writable: true,
      value: function (this: HTMLAnchorElement) {
        capturedDownloadName = this.download
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the header and the privacy notice', () => {
      renderWithProvider()
      expect(screen.getByRole('heading', { name: 'Memex' })).toBeDefined()
      expect(
        screen.getByText(
          'Notes stay in this browser and are never uploaded. Memex cannot protect you from a keylogger or a compromised device — use a device and a browser you trust.'
        )
      ).toBeDefined()
    })

    it('does not overclaim about security', () => {
      renderWithProvider()
      const body = document.body.textContent ?? ''
      expect(body).not.toMatch(/unhackable/i)
      expect(body).not.toMatch(/military-grade/i)
      expect(body).not.toMatch(/100% secure/i)
    })

    it('shows the first-run state offering both a note and a folder', () => {
      renderWithProvider()
      expect(screen.getByText('Choose how to start')).toBeDefined()
      expect(screen.getAllByText('New Note').length).toBeGreaterThan(0)
      expect(screen.getAllByText('New Folder').length).toBeGreaterThan(0)
    })

    it('marks the note fields against autofill and password managers', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())

      const title = screen.getByLabelText('Title')
      expect(title.getAttribute('autocomplete')).toBe('off')
      expect(title.getAttribute('data-1p-ignore')).toBe('true')
      expect(title.getAttribute('data-lpignore')).toBe('true')
      expect(title.getAttribute('spellcheck')).toBe('false')
    })

    it('never puts note content in a title or aria-label attribute', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Secret heading')
      await user.type(screen.getByLabelText('Note'), 'Secret body text')

      // Scan every attribute in the document for the note content. The text
      // itself is allowed to appear as a text node - that is the point - but
      // never inside an attribute, where an extension or a shared pipeline
      // could pick it up without reading the screen.
      //
      // The one exception is the `value` attribute of the very input the user
      // typed into: that is the field's own live value, which any editor has
      // by definition.
      const offenders: string[] = []
      document.querySelectorAll('*').forEach((element) => {
        const attributes = element.attributes
        for (let i = 0; i < attributes.length; i += 1) {
          const attribute = attributes[i]
          const isOwnFieldValue =
            attribute.name === 'value' &&
            (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')

          if (isOwnFieldValue) continue

          if (
            attribute.value.includes('Secret heading') ||
            attribute.value.includes('Secret body text')
          ) {
            offenders.push(`${element.tagName}[${attribute.name}]`)
          }
        }
      })

      expect(offenders).toEqual([])
    })
  })

  describe('notes', () => {
    it('creates a note and lets you type into it', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())

      await user.type(screen.getByLabelText('Title'), 'My account')
      await user.type(screen.getByLabelText('Note'), 'user@example.com')

      expect(screen.getByLabelText('Title')).toHaveValue('My account')
      expect(screen.getByLabelText('Note')).toHaveValue('user@example.com')
    })

    it('normalises tags as they are typed', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Tags'), 'Work, Personal ,work')

      // The stored value is normalised even though the input keeps the raw text.
      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(MEMEX_STORAGE_KEY) ?? '{}')
        expect(stored.notes[0].tags).toEqual(['work', 'personal'])
      })
    })

    it('deletes a note and can undo it', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Temporary')

      await user.click(screen.getByRole('button', { name: 'Delete note' }))

      expect(await screen.findByText('Note deleted')).toBeDefined()
      expect(screen.queryByLabelText('Title')).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Undo' }))

      expect(await screen.findByLabelText('Title')).toHaveValue('Temporary')
    })

    it('filters the list by search term', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Bank account')

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Wifi password')

      await user.type(screen.getByLabelText('Search notes...'), 'bank')

      expect(screen.getByText('Bank account')).toBeDefined()
      expect(screen.queryByText('Wifi password')).toBeNull()
    })
  })

  describe('delete all', () => {
    it('asks for confirmation and then clears the vault', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Doomed')

      await user.click(screen.getByRole('button', { name: 'Delete all notes' }))

      expect(screen.getByText('Delete every note?')).toBeDefined()
      expect(screen.getByText(/This removes all 1 notes/)).toBeDefined()

      await user.click(dialogButton('Delete everything'))

      expect(await screen.findByText('All notes deleted.')).toBeDefined()
      expect(localStorageMock.getItem(MEMEX_STORAGE_KEY)).toBeNull()
    })

    it('keeps the notes when the confirmation is dismissed', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Safe')

      await user.click(screen.getByRole('button', { name: 'Delete all notes' }))
      await user.click(dialogButton('Cancel'))

      expect(screen.queryByText('Delete every note?')).toBeNull()
      expect(screen.getByLabelText('Title')).toHaveValue('Safe')
    })
  })

  describe('export', () => {
    it('requires a password of at least 8 characters', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))

      expect(dialogButton('Export')).toBeDisabled()

      await user.type(screen.getByLabelText('Password'), 'short')
      expect(screen.getByText('Use at least 8 characters.')).toBeDefined()
      expect(dialogButton('Export')).toBeDisabled()

      await user.type(screen.getByLabelText('Password'), 'more')
      await waitFor(() => expect(dialogButton('Export')).not.toBeDisabled())
    })

    it('exports an encrypted file that hides the note content', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Secret note')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(capturedBlob).not.toBeNull())
      const text = await capturedBlob!.text()
      const parsed = JSON.parse(text)

      expect(parsed.encrypted).toBe(true)
      expect(parsed.kdf.name).toBe('argon2id')
      expect(parsed.cipher.name).toBe('xchacha20poly1305')
      // The note content must not be readable in the exported file.
      expect(text).not.toContain('Secret note')
    })

    it('can export without a password when the user opts out', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Plain note')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.click(screen.getByLabelText(/Save without a password/))
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(capturedBlob).not.toBeNull())
      const text = await capturedBlob!.text()
      expect(JSON.parse(text).encrypted).toBe(false)
      expect(text).toContain('Plain note')
    })
  })

  describe('import', () => {
    it('rejects a file that is not a Memex file', async () => {
      const { container } = renderWithProvider()
      const file = new File(['{not json'], 'bad.memex', { type: 'application/json' })

      fireEvent.change(getFileInput(container), { target: { files: [file] } })

      expect(await screen.findByText('This is not a valid Memex file.')).toBeDefined()
    })

    it('reports a wrong password without saying which part was wrong', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      const file = new File(
        [serialiseMemexFile(encryptMemexFile({ version: 1, notes: [] }, 'right-password'))],
        'vault.memex',
        { type: 'application/json' }
      )

      fireEvent.change(getFileInput(container), { target: { files: [file] } })

      await waitFor(() => expect(screen.getByLabelText('Password')).toBeDefined())
      await user.type(screen.getByLabelText('Password'), 'wrong-password')
      await user.click(dialogButton('Import'))

      expect(await screen.findByText('Wrong password or the file is damaged.')).toBeDefined()
    })

    it('imports a plaintext file and replaces the current notes', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      const file = new File(
        [
          serialiseMemexFile(
            createPlaintextMemexFile({
              version: 1,
              notes: [
                {
                  id: 'imported-1',
                  title: 'Imported note',
                  body: 'body',
                  tags: [],
                  pinned: false,
                  createdAt: 1,
                  updatedAt: 1,
                },
              ],
            })
          ),
        ],
        'vault.memex.json',
        { type: 'application/json' }
      )

      fireEvent.change(getFileInput(container), { target: { files: [file] } })

      // A plaintext file needs no password, so no password field is shown.
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
      expect(within(screen.getByRole('dialog')).queryByLabelText('Password')).toBeNull()

      await user.click(dialogButton('Import'))

      expect(await screen.findByText('Imported 1 notes and 0 folders.')).toBeDefined()
      // The note shows in the sidebar tree and in the main list.
      expect(screen.getAllByText('Imported note').length).toBeGreaterThan(0)
    })
  })

  describe('folders', () => {
    it('creates a folder and shows it in the tree', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      expect(await screen.findByText('Folder created')).toBeDefined()
      // The name shows in the sidebar tree and as the open folder's heading.
      expect(screen.getAllByText('Work').length).toBeGreaterThan(0)
    })

    it('refuses to create a folder with an empty name', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      expect(dialogButton('Create folder')).toBeDisabled()
    })

    it('moves a note into a folder', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      // Create a folder first.
      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      // Create a note.
      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Bank account')

      // File it under the folder.
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(MEMEX_STORAGE_KEY) ?? '{}')
        expect(stored.notes[0].folderId).toBeTruthy()
        expect(stored.folders).toHaveLength(1)
      })
    })

    it('keeps the notes of a deleted folder as unfiled', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Bank account')
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(MEMEX_STORAGE_KEY) ?? '{}')
        expect(stored.notes[0].folderId).toBeTruthy()
      })

      await user.click(screen.getByRole('button', { name: 'Delete folder: Work' }))
      expect(screen.getByText('Delete folder?')).toBeDefined()
      await user.click(dialogButton('Delete folder'))

      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(MEMEX_STORAGE_KEY) ?? '{}')
        expect(stored.folders).toHaveLength(0)
        // The note survives - it becomes unfiled rather than being deleted.
        expect(stored.notes).toHaveLength(1)
        expect(stored.notes[0].folderId).toBeNull()
      })
    })

    it('filters the tree as well as the list when searching', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Bank account')

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Wifi password')

      await user.type(screen.getByLabelText('Search notes...'), 'bank')

      expect(screen.getByText('Bank account')).toBeDefined()
      expect(screen.queryByText('Wifi password')).toBeNull()
    })
  })

  describe('view modes', () => {
    /** Creates a folder with one note filed inside it. */
    async function setupFolderWithNote(user: ReturnType<typeof userEvent.setup>) {
      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Filed note')
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(MEMEX_STORAGE_KEY) ?? '{}')
        expect(stored.notes[0].folderId).toBeTruthy()
      })
    }

    it('hides a note that is inside a folder until the folder is opened', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await setupFolderWithNote(user)

      // The note is selected, so it shows in the editor rather than a list.
      expect(screen.getByLabelText('Title')).toHaveValue('Filed note')

      // Close the folder - the note must disappear from the general list.
      await user.click(screen.getByRole('button', { name: 'Open folder: Work' }))
      expect(screen.queryByText('Filed note')).toBeNull()
      expect(screen.getByText(/notes are filed in folders/)).toBeDefined()

      // Open it again - now the note is listed.
      await user.click(screen.getByRole('button', { name: 'Open folder: Work' }))
      expect(screen.getAllByText('Filed note').length).toBeGreaterThan(0)
    })

    it('shows every note in the flat view', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await setupFolderWithNote(user)

      // Switch to the flat view.
      await user.click(screen.getByRole('button', { name: 'All' }))
      expect(screen.getAllByText('Filed note').length).toBeGreaterThan(0)
    })

    it('does not render an "All notes" row in the sidebar', () => {
      renderWithProvider()
      // The sidebar used to have an "All notes" button; it is now a view
      // toggle instead.
      expect(screen.queryByRole('button', { name: 'All notes' })).toBeNull()
    })
  })

  describe('export naming', () => {
    it('lets the user name the exported file', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Named note')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('File name'), 'my vault')
      expect(screen.getByText('Saved as my vault.memex')).toBeDefined()

      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(capturedBlob).not.toBeNull())
      // The download uses the name the user typed, with the right extension.
      expect(capturedDownloadName).toBe('my vault.memex')
    })

    it('keeps a name the user typed with an extension', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('File name'), 'backup.memex')
      expect(screen.getByText('Saved as backup.memex')).toBeDefined()
    })

    it('strips characters that are illegal in a file name', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('File name'), 'a/b:c')
      expect(screen.getByText('Saved as abc.memex')).toBeDefined()
    })

    it('falls back to a download when writing to the chosen location fails', async () => {
      const user = userEvent.setup()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // A picker that hands back a location the write cannot use - the file
      // is created by the browser but stays empty. The export must not be
      // lost: it falls back to a normal download.
      Object.defineProperty(window, 'showSaveFilePicker', {
        writable: true,
        configurable: true,
        value: vi.fn(async () => ({
          createWritable: async () => {
            throw new Error('the location is not writable')
          },
        })),
      })

      renderWithProvider()
      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Named note')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(capturedBlob).not.toBeNull())
      // The fallback download happened and the export is reported as done.
      expect(capturedDownloadName).toBeTruthy()
      expect(screen.queryByText('Could not export the notes. Please try again.')).toBeNull()
      expect(await screen.findByText('Export downloaded.')).toBeDefined()

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
      errorSpy.mockRestore()
    })

    it('removes the file the picker created before falling back to a download', async () => {
      const user = userEvent.setup()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const remove = vi.fn(async () => {})
      // The picker hands back a location the write cannot use. The browser
      // already created an empty file there, so it has to be deleted: the
      // export must end with one file, not a broken one plus a download.
      Object.defineProperty(window, 'showSaveFilePicker', {
        writable: true,
        configurable: true,
        value: vi.fn(async () => ({
          createWritable: async () => {
            throw new Error('the location is not writable')
          },
          remove,
        })),
      })

      renderWithProvider()
      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Named note')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(capturedBlob).not.toBeNull())
      expect(remove).toHaveBeenCalledTimes(1)
      // The fallback download still names the file like a normal export.
      expect(capturedDownloadName).toMatch(/^memex-\d{8}-\d{4}\.memex$/)
      expect(await screen.findByText('Export downloaded.')).toBeDefined()

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
      errorSpy.mockRestore()
    })

    it('retries once when the first write fails', async () => {
      const user = userEvent.setup()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const write = vi.fn(async () => {})
      const close = vi.fn(async () => {})
      const remove = vi.fn(async () => {})
      let attempts = 0
      Object.defineProperty(window, 'showSaveFilePicker', {
        writable: true,
        configurable: true,
        value: vi.fn(async () => ({
          createWritable: async () => {
            attempts += 1
            // A transient lock: the second attempt gets a working stream.
            if (attempts === 1) throw new Error('temporarily locked')
            return { write, close }
          },
          remove,
        })),
      })

      renderWithProvider()
      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Named note')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      expect(await screen.findByText('Export downloaded.')).toBeDefined()
      expect(attempts).toBe(2)
      expect(write).toHaveBeenCalledTimes(1)
      expect(close).toHaveBeenCalledTimes(1)
      // The retry succeeded, so nothing was deleted and nothing downloaded.
      expect(remove).not.toHaveBeenCalled()
      expect(capturedBlob).toBeNull()

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
      errorSpy.mockRestore()
    })

    it('falls back to a download when the picker itself is refused', async () => {
      const user = userEvent.setup()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      Object.defineProperty(window, 'showSaveFilePicker', {
        writable: true,
        configurable: true,
        value: vi.fn(async () => {
          throw new DOMException('denied', 'NotAllowedError')
        }),
      })

      renderWithProvider()
      await user.click(newNoteButton())

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(capturedBlob).not.toBeNull())
      expect(screen.queryByText('Could not export the notes. Please try again.')).toBeNull()

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
      errorSpy.mockRestore()
    })

    it('does nothing when the picker is cancelled', async () => {
      const user = userEvent.setup()
      Object.defineProperty(window, 'showSaveFilePicker', {
        writable: true,
        configurable: true,
        value: vi.fn(async () => {
          throw new DOMException('cancelled', 'AbortError')
        }),
      })

      renderWithProvider()
      await user.click(newNoteButton())

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      // Nothing is written, the dialog stays open and the button is usable.
      await waitFor(() =>
        expect(screen.getByRole('dialog', { name: 'Export your notes' })).toBeDefined()
      )
      expect(capturedBlob).toBeNull()
      expect(dialogButton('Export')).not.toBeDisabled()

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
    })
  })

  describe('privacy', () => {
    it('never logs note content to the console', async () => {
      const user = userEvent.setup()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'super-secret-title')
      await user.type(screen.getByLabelText('Note'), 'super-secret-body')

      const calls = [
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...warnSpy.mock.calls,
      ].flat()

      expect(calls.filter((c) => String(c).includes('super-secret'))).toEqual([])
    })

    it('makes no network calls', async () => {
      const user = userEvent.setup()
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'No network note')

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
