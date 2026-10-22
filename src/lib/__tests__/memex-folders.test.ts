import { describe, it, expect } from 'vitest'
import {
  encryptMemexFile,
  decryptMemexFile,
  serialiseMemexFile,
  deserialiseMemexFile,
  createPlaintextMemexFile,
} from '@/lib/memex-crypto'
import { sanitiseDocument, type MemexFolder } from '@/lib/memex'

const FAST = { kdf: { m: 1024, t: 1, p: 1, dkLen: 32 }, minKdfMemory: 1024 }

const FOLDERS: MemexFolder[] = [
  { id: 'f1', name: 'Work', createdAt: 1, updatedAt: 1 },
  { id: 'f2', name: 'Personal', createdAt: 2, updatedAt: 2 },
  { id: 'f3', name: 'Archive', createdAt: 3, updatedAt: 3 },
]

describe('empty-folder round trip', () => {
  it('round-trips three folders with no notes at all', () => {
    const payload = { version: 2, folders: FOLDERS, notes: [] }

    const file = encryptMemexFile(payload, 'pw', '2026-01-01T00:00:00.000Z', FAST)
    const text = serialiseMemexFile(file)

    const reparsed = deserialiseMemexFile(text)
    expect(reparsed.encrypted).toBe(true)
    if (!reparsed.encrypted) throw new Error('expected an encrypted file')

    const decrypted = decryptMemexFile(reparsed, 'pw', FAST)
    const vault = sanitiseDocument(decrypted)

    expect(vault.folders).toHaveLength(3)
    expect(vault.folders.map((f) => f.name)).toEqual(['Work', 'Personal', 'Archive'])
    expect(vault.notes).toEqual([])
  })

  it('round-trips three empty folders through a plaintext export', () => {
    const payload = { version: 2, folders: FOLDERS, notes: [] }
    const file = createPlaintextMemexFile(payload)
    const parsed = deserialiseMemexFile(serialiseMemexFile(file))
    expect(parsed.encrypted).toBe(false)
    if (!parsed.encrypted) {
      const vault = sanitiseDocument(parsed)
      expect(vault.folders).toHaveLength(3)
    }
  })

  it('round-trips three empty folders through an encrypted export', () => {
    const payload = { version: 2, folders: FOLDERS, notes: [] }
    const file = encryptMemexFile(payload, 'pw', '2026-01-01T00:00:00.000Z', FAST)
    const reparsed = deserialiseMemexFile(serialiseMemexFile(file))
    expect(reparsed.encrypted).toBe(true)
    if (reparsed.encrypted) {
      const decrypted = decryptMemexFile(reparsed, 'pw', FAST)
      const vault = sanitiseDocument(decrypted)
      expect(vault.folders).toHaveLength(3)
      expect(vault.folders.map((f) => f.name)).toEqual(['Work', 'Personal', 'Archive'])
    }
  })

  it('keeps the folder names in the encrypted payload', () => {
    const payload = { version: 2, folders: FOLDERS, notes: [] }
    const file = encryptMemexFile(payload, 'pw', '2026-01-01T00:00:00.000Z', FAST)
    expect(serialiseMemexFile(file)).not.toContain('Work')
    expect(serialiseMemexFile(file)).not.toContain('Personal')
  })
})
