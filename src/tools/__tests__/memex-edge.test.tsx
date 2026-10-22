import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/lib/language-context'
import { Memex } from '@/tools/memex'
import { MEMEX_STORAGE_KEY } from '@/lib/memex'
import {
  createPlaintextMemexFile,
  decryptMemexFile,
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

function newNoteButton() {
  return screen.getAllByRole('button', { name: 'New Note' })[0]
}

function newFolderButton() {
  return screen.getAllByRole('button', { name: 'New Folder' })[0]
}

function dialogButton(name: string) {
  const dialogs = screen.getAllByRole('dialog')
  return within(dialogs[dialogs.length - 1]).getByRole('button', { name })
}

/** The stored vault, or null when nothing is stored. */
function stored(): { version: number; folders: unknown[]; notes: unknown[] } | null {
  const raw = localStorageMock.getItem(MEMEX_STORAGE_KEY)
  if (!raw) return null
  return JSON.parse(raw)
}

describe('Memex - stress and edge cases', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // jsdom cannot navigate to a blob URL, so the download click is stubbed.
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      writable: true,
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => 'blob:mock'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('empty and minimal vaults', () => {
    it('exports a vault with no notes and no folders at all', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(screen.getByText('Export downloaded.')).toBeDefined())
    })

    it('exports with a password of exactly the minimum length', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), '12345678')
      await waitFor(() => expect(dialogButton('Export')).not.toBeDisabled())
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(screen.getByText('Export downloaded.')).toBeDefined())
    })

    it('exports without a password when the user opts out', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.click(screen.getByLabelText(/Save without a password/))
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(screen.getByText('Export downloaded.')).toBeDefined())
    })
  })

  describe('hostile content', () => {
    it('renders a note whose title is a script tag as text', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      // `userEvent.type` mangles characters that are special in its own
      // syntax, so the value is set directly to test the app's rendering.
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: '<script>window.__pwned=1</script>' },
      })

      expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
      expect(screen.getByLabelText('Title')).toHaveValue('<script>window.__pwned=1</script>')
      // The script tag is not in the document as an element.
      expect(
        Array.from(document.querySelectorAll('script')).some((s) =>
          s.textContent?.includes('__pwned')
        )
      ).toBe(false)
    })

    it('renders a note whose body contains HTML as text', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      fireEvent.change(screen.getByLabelText('Note'), {
        target: { value: '<img src=x onerror="window.__pwned=1">' },
      })

      expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
      expect(document.querySelector('img[src="x"]')).toBeNull()
    })

    it('accepts a very long title without breaking the layout', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newNoteButton())
      const long = 'x'.repeat(500)
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: long } })

      expect(screen.getByLabelText('Title')).toHaveValue(long)
      await waitFor(() => {
        expect((stored()?.notes as { title: string }[])[0].title).toBe(long)
      })
    })

    it('accepts a folder name with slashes and quotes', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      fireEvent.change(screen.getByLabelText('Folder name'), {
        target: { value: 'a/b "c" <d>' },
      })
      await user.click(dialogButton('Create folder'))

      await waitFor(() => expect(stored()?.folders).toHaveLength(1))
      expect((stored()?.folders as { name: string }[])[0].name).toBe('a/b "c" <d>')
    })
  })

  describe('folders', () => {
    it('allows two folders with the same name', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      for (let i = 0; i < 2; i++) {
        await user.click(newFolderButton())
        await user.type(screen.getByLabelText('Folder name'), 'Work')
        await user.click(dialogButton('Create folder'))
      }

      await waitFor(() => expect(stored()?.folders).toHaveLength(2))
    })

    it('keeps the notes of a deleted folder and files them as unfiled', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Inside')
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await waitFor(() => {
        const notes = stored()?.notes as { folderId: string | null }[]
        expect(notes[0].folderId).toBeTruthy()
      })

      await user.click(screen.getByRole('button', { name: 'Delete folder: Work' }))
      await user.click(dialogButton('Delete folder'))

      await waitFor(() => {
        const vault = stored()!
        expect(vault.folders).toHaveLength(0)
        expect(vault.notes).toHaveLength(1)
        expect((vault.notes as { folderId: string | null }[])[0].folderId).toBeNull()
      })
    })

    it('moves a note from one folder to another', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Personal')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Movable')
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await waitFor(() => {
        expect((stored()?.notes as { folderId: string }[])[0].folderId).toBeTruthy()
      })

      const workId = (stored()?.folders as { id: string; name: string }[]).find(
        (f) => f.name === 'Work'
      )!.id
      const personalId = (stored()?.folders as { id: string; name: string }[]).find(
        (f) => f.name === 'Personal'
      )!.id

      await user.selectOptions(screen.getByLabelText('Folder'), personalId)

      await waitFor(() => {
        expect((stored()?.notes as { folderId: string }[])[0].folderId).toBe(personalId)
      })
      expect(workId).not.toBe(personalId)
    })

    it('files a note as unfiled again through the dropdown', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await waitFor(() => {
        expect((stored()?.notes as { folderId: string }[])[0].folderId).toBeTruthy()
      })

      await user.selectOptions(screen.getByLabelText('Folder'), '')

      await waitFor(() => {
        expect((stored()?.notes as { folderId: string | null }[])[0].folderId).toBeNull()
      })
    })
  })

  describe('import', () => {
    it('imports a v1 file and files its notes as unfiled', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      const v1 = {
        format: 'kitbag-memex',
        version: 1,
        encrypted: false,
        exportedAt: '2025-01-01T00:00:00.000Z',
        notes: [
          { id: 'old-1', title: 'Old note', body: 'body', tags: [], pinned: false, createdAt: 1, updatedAt: 1 },
        ],
      }
      const file = new File([JSON.stringify(v1)], 'old.memex.json', { type: 'application/json' })

      fireEvent.change(getFileInput(container), { target: { files: [file] } })

      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
      await user.click(dialogButton('Import'))

      await waitFor(() => expect(screen.getByText('Imported 1 notes and 0 folders.')).toBeDefined())
      await waitFor(() => expect(stored()?.notes).toHaveLength(1))
      const notes = stored()?.notes as { folderId: string | null; title: string }[]
      expect(notes[0].folderId).toBeNull()
      expect(notes[0].title).toBe('Old note')
    })

    it('leaves the vault untouched when the file is corrupted', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Keep me')
      await waitFor(() => expect(stored()?.notes).toHaveLength(1))

      const file = new File(['{ this is not json'], 'broken.memex', { type: 'application/json' })
      fireEvent.change(getFileInput(container), { target: { files: [file] } })

      await waitFor(() =>
        expect(screen.getByText('This is not a valid Memex file.')).toBeDefined()
      )
      // The existing note is still there.
      expect(stored()?.notes).toHaveLength(1)
    })

    it('replaces the vault on import and drops the old notes', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Old note')
      await waitFor(() => expect(stored()?.notes).toHaveLength(1))

      const file = new File(
        [
          serialiseMemexFile(
            createPlaintextMemexFile({
              version: 2,
              folders: [{ id: 'f9', name: 'Imported', createdAt: 1, updatedAt: 1 }],
              notes: [
                { id: 'n9', title: 'New note', body: '', tags: [], pinned: false, folderId: 'f9', createdAt: 1, updatedAt: 1 },
              ],
            })
          ),
        ],
        'vault.memex.json',
        { type: 'application/json' }
      )

      fireEvent.change(getFileInput(container), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
      await user.click(dialogButton('Import'))

      await waitFor(() => expect(screen.getByText('Imported 1 notes and 1 folders.')).toBeDefined())
      await waitFor(() =>
        expect((stored()?.notes as { title: string }[])[0]?.title).toBe('New note')
      )
      const vault = stored()!
      expect(vault.notes).toHaveLength(1)
      expect((vault.notes as { title: string }[])[0].title).toBe('New note')
      expect(vault.folders).toHaveLength(1)
    })

    it('merges without duplicating a note that already exists', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Same')
      await waitFor(() => expect(stored()?.notes).toHaveLength(1))
      const existingId = (stored()?.notes as { id: string }[])[0].id

      const file = new File(
        [
          serialiseMemexFile(
            createPlaintextMemexFile({
              version: 2,
              folders: [],
              notes: [
                { id: existingId, title: 'Same', body: '', tags: [], pinned: false, folderId: null, createdAt: 1, updatedAt: 1 },
                { id: 'other', title: 'Other', body: '', tags: [], pinned: false, folderId: null, createdAt: 1, updatedAt: 1 },
              ],
            })
          ),
        ],
        'vault.memex.json',
        { type: 'application/json' }
      )

      fireEvent.change(getFileInput(container), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
      await user.click(screen.getByRole('radio', { name: /Keep current notes/ }))
      await user.click(dialogButton('Import'))

      await waitFor(() => expect(screen.getByText(/Imported 1 notes/)).toBeDefined())
      await waitFor(() => {
        const titles = (stored()?.notes as { title: string }[]).map((n) => n.title)
        expect(titles.sort()).toEqual(['Other', 'Same'])
      })
    })

    it('imports an encrypted file with the right password', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      const file = new File(
        [
          serialiseMemexFile(
            encryptMemexFile(
              {
                version: 2,
                folders: [{ id: 'f1', name: 'Secret folder', createdAt: 1, updatedAt: 1 }],
                notes: [
                  { id: 'n1', title: 'Secret', body: 'x', tags: [], pinned: false, folderId: 'f1', createdAt: 1, updatedAt: 1 },
                ],
              },
              'right-password'
            )
          ),
        ],
        'vault.memex',
        { type: 'application/json' }
      )

      fireEvent.change(getFileInput(container), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByLabelText('Password')).toBeDefined())
      await user.type(screen.getByLabelText('Password'), 'right-password')
      await user.click(dialogButton('Import'))

      await waitFor(() => expect(screen.getByText('Imported 1 notes and 1 folders.')).toBeDefined())
      await waitFor(() =>
        expect((stored()?.notes as { title: string }[])[0]?.title).toBe('Secret')
      )
      const vault = stored()!
      expect((vault.folders as { name: string }[])[0].name).toBe('Secret folder')
    })

    it('does not change the vault when the password is wrong', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Keep me')
      await waitFor(() => expect(stored()?.notes).toHaveLength(1))

      const file = new File(
        [serialiseMemexFile(encryptMemexFile({ version: 2, folders: [], notes: [] }, 'right'))],
        'vault.memex',
        { type: 'application/json' }
      )
      fireEvent.change(getFileInput(container), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByLabelText('Password')).toBeDefined())
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(dialogButton('Import'))

      await waitFor(() =>
        expect(screen.getByText('Wrong password or the file is damaged.')).toBeDefined()
      )
      expect(stored()?.notes).toHaveLength(1)
    })
  })

  describe('toasts', () => {
    it('dismisses a non-undo toast on its own', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      expect(await screen.findByText('Folder created')).toBeDefined()

      // It goes away on its own - a stale message must not sit next to a
      // later result and look like part of it.
      await waitFor(() => expect(screen.queryByText('Folder created')).toBeNull(), {
        timeout: 6000,
      })
    })
  })

  describe('export state', () => {
    it('does not keep the password after the dialog is closed', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'secret-password')
      await user.click(dialogButton('Cancel'))

      await user.click(screen.getByRole('button', { name: 'Export' }))
      expect(screen.getByLabelText('Password')).toHaveValue('')
    })

    it('does not keep the import password after the dialog is closed', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProvider()

      const file = new File(
        [serialiseMemexFile(encryptMemexFile({ version: 2, folders: [], notes: [] }, 'right'))],
        'vault.memex',
        { type: 'application/json' }
      )
      fireEvent.change(getFileInput(container), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByLabelText('Password')).toBeDefined())
      await user.type(screen.getByLabelText('Password'), 'right')
      await user.click(dialogButton('Cancel'))

      fireEvent.change(getFileInput(container), { target: { files: [file] } })
      await waitFor(() => expect(screen.getByLabelText('Password')).toBeDefined())
      expect(screen.getByLabelText('Password')).toHaveValue('')
    })

    it('counts notes and folders separately when deleting everything', async () => {
      const user = userEvent.setup()
      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())

      await user.click(screen.getByRole('button', { name: 'Delete all notes' }))
      expect(
        screen.getByText('This removes all 1 notes and 1 folders from this browser. It cannot be undone.')
      ).toBeDefined()
    })
  })

  describe('when the browser cannot encrypt', () => {
    it('warns and refuses to offer an encrypted export', async () => {
      const user = userEvent.setup()
      const original = globalThis.crypto
      // A browser without `getRandomValues` cannot produce a safe salt or
      // nonce, so the tool has to say so instead of failing mid-export.
      Object.defineProperty(globalThis, 'crypto', {
        value: { getRandomValues: undefined },
        configurable: true,
      })

      renderWithProvider()
      await waitFor(() =>
        expect(screen.getByText(/Encryption is not available in this browser context/)).toBeDefined()
      )

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      expect(dialogButton('Export')).toBeDisabled()

      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    })
  })

  describe('the encrypted file really is encrypted', () => {
    it('hides the folder names and the note content', async () => {
      const user = userEvent.setup()
      let exported = ''

      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        value: vi.fn((blob: Blob) => {
          void blob.text().then((text) => {
            exported = text
          })
          return 'blob:mock'
        }),
      })
      Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() })
      Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })

      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Bank accounts')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'My IBAN')
      await user.type(screen.getByLabelText('Note'), 'DE89 3704 0044 0532 0130 00')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(exported).not.toBe(''))
      expect(exported).not.toContain('Bank accounts')
      expect(exported).not.toContain('DE89 3704')
      expect(exported).not.toContain('a-good-password')
      expect(JSON.parse(exported).encrypted).toBe(true)
    })

    it('decrypts back to the same vault with the same password', async () => {
      const user = userEvent.setup()
      let exported = ''

      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        value: vi.fn((blob: Blob) => {
          void blob.text().then((text) => {
            exported = text
          })
          return 'blob:mock'
        }),
      })
      Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() })
      Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })

      renderWithProvider()

      await user.click(newFolderButton())
      await user.type(screen.getByLabelText('Folder name'), 'Work')
      await user.click(dialogButton('Create folder'))

      await user.click(newNoteButton())
      await user.type(screen.getByLabelText('Title'), 'Round trip')
      await user.selectOptions(screen.getByLabelText('Folder'), 'Work')

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.type(screen.getByLabelText('Password'), 'a-good-password')
      await user.click(dialogButton('Export'))

      await waitFor(() => expect(exported).not.toBe(''))

      const parsed = JSON.parse(exported)
      const decrypted = decryptMemexFile(parsed, 'a-good-password') as {
        folders: { name: string }[]
        notes: { title: string; folderId: string }[]
      }
      expect(decrypted.folders).toHaveLength(1)
      expect(decrypted.folders[0].name).toBe('Work')
      expect(decrypted.notes[0].title).toBe('Round trip')
      expect(decrypted.notes[0].folderId).toBeTruthy()
    })
  })
})
