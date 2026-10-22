import { describe, it, expect, beforeEach } from 'vitest'
import {
  MEMEX_STORAGE_KEY,
  MEMEX_FORMAT_VERSION,
  MAX_TAGS,
  UNFILED,
  clearStoredVault,
  countNotes,
  createEmptyFolder,
  createEmptyNote,
  createId,
  deleteFolder,
  loadVault,
  mergeFolders,
  mergeNotes,
  moveNoteToFolder,
  normaliseFolderName,
  normaliseTag,
  normaliseTags,
  parseTagInput,
  sanitiseDocument,
  sanitiseFolder,
  sanitiseNote,
  saveVault,
  sortFolders,
  sortNotes,
  type MemexFolder,
  type MemexNote,
} from '@/lib/memex'

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

const FOLDER: MemexFolder = {
  id: 'folder-1',
  name: 'Work',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

const NOTE: MemexNote = {
  id: 'note-1',
  title: 'My account',
  body: 'user@example.com',
  tags: ['account'],
  pinned: true,
  folderId: FOLDER.id,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

describe('memex', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('tag normalisation', () => {
    it('trims and lowercases a tag', () => {
      expect(normaliseTag('  Account  ')).toBe('account')
    })

    it('de-duplicates tags', () => {
      expect(normaliseTags(['a', 'A', 'a'])).toEqual(['a'])
    })

    it('drops empty tags', () => {
      expect(normaliseTags(['', '   ', 'x'])).toEqual(['x'])
    })

    it('caps the number of tags', () => {
      const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag${i}`)
      expect(normaliseTags(many)).toHaveLength(MAX_TAGS)
    })

    it('parses a comma separated string', () => {
      expect(parseTagInput('Work, Personal ,work')).toEqual(['work', 'personal'])
    })
  })

  describe('folder name normalisation', () => {
    it('trims and collapses whitespace', () => {
      expect(normaliseFolderName('  My   Folder  ')).toBe('My Folder')
    })

    it('caps the length', () => {
      expect(normaliseFolderName('x'.repeat(200))).toHaveLength(60)
    })
  })

  describe('note creation', () => {
    it('creates a blank note with an id and timestamps', () => {
      const note = createEmptyNote()
      expect(note.id).toBeTruthy()
      expect(note.title).toBe('')
      expect(note.body).toBe('')
      expect(note.tags).toEqual([])
      expect(note.pinned).toBe(false)
      expect(note.folderId).toBe(UNFILED)
      expect(note.createdAt).toBeGreaterThan(0)
      expect(note.updatedAt).toBeGreaterThan(0)
    })

    it('creates a note inside a folder', () => {
      const note = createEmptyNote('folder-9')
      expect(note.folderId).toBe('folder-9')
    })

    it('creates unique ids', () => {
      const ids = new Set(Array.from({ length: 50 }, () => createId()))
      expect(ids.size).toBe(50)
    })
  })

  describe('folder creation', () => {
    it('creates a folder with a normalised name', () => {
      const folder = createEmptyFolder('  My  Folder ')
      expect(folder.id).toBeTruthy()
      expect(folder.name).toBe('My Folder')
      expect(folder.createdAt).toBeGreaterThan(0)
    })
  })

  describe('sanitising', () => {
    it('keeps a valid note intact', () => {
      expect(sanitiseNote(NOTE)).toEqual(NOTE)
    })

    it('rejects a note without an id', () => {
      expect(sanitiseNote({ ...NOTE, id: '' })).toBeNull()
      expect(sanitiseNote({ ...NOTE, id: undefined })).toBeNull()
      expect(sanitiseNote(null)).toBeNull()
      expect(sanitiseNote('nope')).toBeNull()
    })

    it('files a note with no folder as unfiled', () => {
      expect(sanitiseNote({ id: 'x' })?.folderId).toBe(UNFILED)
    })

    it('keeps a valid folder intact', () => {
      expect(sanitiseFolder(FOLDER)).toEqual(FOLDER)
    })

    it('rejects a folder without an id', () => {
      expect(sanitiseFolder({ ...FOLDER, id: '' })).toBeNull()
      expect(sanitiseFolder(null)).toBeNull()
    })

    it('drops malformed notes from a document', () => {
      const document = sanitiseDocument({ notes: [NOTE, { title: 'no id' }, null] })
      expect(document.notes).toHaveLength(1)
      expect(document.version).toBe(MEMEX_FORMAT_VERSION)
    })

    it('handles a document with no notes array', () => {
      expect(sanitiseDocument({}).notes).toEqual([])
      expect(sanitiseDocument(null).notes).toEqual([])
    })

    it('reads a v1 document (notes only, no folders)', () => {
      const document = sanitiseDocument({
        version: 1,
        notes: [{ id: 'n1', title: 'Old note', body: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1 }],
      })
      expect(document.folders).toEqual([])
      expect(document.notes).toHaveLength(1)
      expect(document.notes[0].folderId).toBe(UNFILED)
    })

    it('files a note whose folder is missing as unfiled', () => {
      const document = sanitiseDocument({
        version: 2,
        folders: [],
        notes: [{ ...NOTE, folderId: 'does-not-exist' }],
      })
      expect(document.notes[0].folderId).toBe(UNFILED)
    })
  })

  describe('persistence', () => {
    it('round-trips folders and notes through localStorage', () => {
      saveVault([FOLDER], [NOTE])
      const vault = loadVault()
      expect(vault.folders).toEqual([FOLDER])
      expect(vault.notes).toEqual([NOTE])
    })

    it('stores under the documented key', () => {
      saveVault([FOLDER], [NOTE])
      expect(localStorageMock.getItem(MEMEX_STORAGE_KEY)).toBeTruthy()
      expect(MEMEX_STORAGE_KEY).toBe('kitbag-memex:notes')
    })

    it('returns an empty vault when nothing is stored', () => {
      expect(loadVault().notes).toEqual([])
      expect(loadVault().folders).toEqual([])
    })

    it('returns an empty vault for a corrupted entry', () => {
      localStorageMock.setItem(MEMEX_STORAGE_KEY, '{not json')
      expect(loadVault().notes).toEqual([])
    })

    it('drops malformed entries from a stored document', () => {
      localStorageMock.setItem(
        MEMEX_STORAGE_KEY,
        JSON.stringify({ version: 2, folders: [{ id: 'f1', name: 'F' }], notes: [NOTE, { title: 'no id' }] })
      )
      const vault = loadVault()
      expect(vault.notes).toHaveLength(1)
      expect(vault.folders).toHaveLength(1)
    })

    it('clears the stored vault', () => {
      saveVault([FOLDER], [NOTE])
      clearStoredVault()
      expect(localStorageMock.getItem(MEMEX_STORAGE_KEY)).toBeNull()
      expect(loadVault().notes).toEqual([])
    })

    it('survives a storage failure', () => {
      const original = localStorageMock.setItem
      localStorageMock.setItem = () => { throw new Error('quota exceeded') }
      expect(() => saveVault([FOLDER], [NOTE])).not.toThrow()

      localStorageMock.getItem = () => { throw new Error('storage disabled') }
      expect(loadVault().notes).toEqual([])

      localStorageMock.setItem = original
    })
  })

  describe('sorting', () => {
    it('puts pinned notes first', () => {
      const notes: MemexNote[] = [
        { ...NOTE, id: 'a', pinned: false, updatedAt: 300 },
        { ...NOTE, id: 'b', pinned: true, updatedAt: 200 },
      ]
      expect(sortNotes(notes).map((n) => n.id)).toEqual(['b', 'a'])
    })

    it('sortes by most recently updated within a pin group', () => {
      const notes: MemexNote[] = [
        { ...NOTE, id: 'a', pinned: false, updatedAt: 100 },
        { ...NOTE, id: 'b', pinned: false, updatedAt: 300 },
        { ...NOTE, id: 'c', pinned: false, updatedAt: 200 },
      ]
      expect(sortNotes(notes).map((n) => n.id)).toEqual(['b', 'c', 'a'])
    })

    it('does not mutate the input', () => {
      const notes: MemexNote[] = [
        { ...NOTE, id: 'a', pinned: false, updatedAt: 100 },
        { ...NOTE, id: 'b', pinned: true, updatedAt: 200 },
      ]
      const copy = [...notes]
      sortNotes(notes)
      expect(notes).toEqual(copy)
    })

    it('sorts folders alphabetically, case-insensitively', () => {
      const folders: MemexFolder[] = [
        { ...FOLDER, id: 'b', name: 'alpha' },
        { ...FOLDER, id: 'a', name: 'Beta' },
      ]
      expect(sortFolders(folders).map((f) => f.name)).toEqual(['alpha', 'Beta'])
    })
  })

  describe('folder helpers', () => {
    it('counts the notes per folder', () => {
      const notes: MemexNote[] = [
        { ...NOTE, id: 'a', folderId: 'f1' },
        { ...NOTE, id: 'b', folderId: 'f1' },
        { ...NOTE, id: 'c', folderId: UNFILED },
      ]
      const counts = countNotes(notes)
      expect(counts.get('f1')).toBe(2)
      expect(counts.get(UNFILED)).toBe(1)
    })

    it('moves a note into a folder', () => {
      const moved = moveNoteToFolder([{ ...NOTE, folderId: UNFILED }], NOTE.id, 'f2')
      expect(moved[0].folderId).toBe('f2')
    })

    it('moves a note out of every folder', () => {
      const moved = moveNoteToFolder([NOTE], NOTE.id, UNFILED)
      expect(moved[0].folderId).toBe(UNFILED)
    })

    it('deletes a folder but keeps its notes as unfiled', () => {
      const result = deleteFolder([FOLDER], [NOTE], FOLDER.id)
      expect(result.folders).toEqual([])
      expect(result.notes).toHaveLength(1)
      expect(result.notes[0].folderId).toBe(UNFILED)
      expect(result.notes[0].title).toBe(NOTE.title)
    })

    it('leaves other folders alone when deleting one', () => {
      const other = { ...FOLDER, id: 'folder-2', name: 'Personal' }
      const result = deleteFolder([FOLDER, other], [NOTE], FOLDER.id)
      expect(result.folders).toEqual([other])
    })
  })

  describe('merge', () => {
    it('adds notes that are not already present', () => {
      const imported = [{ ...NOTE, id: 'note-2', title: 'Second' }]
      const result = mergeNotes([NOTE], imported)
      expect(result.added).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.notes).toHaveLength(2)
    })

    it('skips a note with a matching id', () => {
      const result = mergeNotes([NOTE], [NOTE])
      expect(result.added).toBe(0)
      expect(result.skipped).toBe(1)
      expect(result.notes).toHaveLength(1)
    })

    it('counts duplicates inside the imported batch', () => {
      const result = mergeNotes([], [NOTE, NOTE])
      expect(result.added).toBe(1)
      expect(result.skipped).toBe(1)
    })

    it('adds folders that are not already present', () => {
      const imported = { ...FOLDER, id: 'folder-2', name: 'Personal' }
      const result = mergeFolders([FOLDER], [imported])
      expect(result.added).toBe(1)
      expect(result.folders).toHaveLength(2)
    })

    it('skips a folder with a matching id', () => {
      const result = mergeFolders([FOLDER], [FOLDER])
      expect(result.added).toBe(0)
      expect(result.folders).toHaveLength(1)
    })
  })
})
