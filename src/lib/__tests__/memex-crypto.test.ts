import { describe, it, expect } from 'vitest'
import {
  ARGON2_PARAMS,
  MEMEX_FORMAT,
  MEMEX_VERSION,
  MIN_KDF_MEMORY,
  MemexDecryptError,
  MemexFormatError,
  createPlaintextMemexFile,
  decryptMemexFile,
  deserialiseMemexFile,
  encryptMemexFile,
  parseMemexFile,
  serialiseMemexFile,
} from '@/lib/memex-crypto'

// Argon2id is deliberately expensive. Production cost (19 MiB) is asserted as
// a constant, but the round trips use a much smaller cost so the suite stays
// fast.
const FAST_KDF = { m: 1024, t: 1, p: 1, dkLen: 32 }
const FAST_OPTIONS = { kdf: FAST_KDF, minKdfMemory: FAST_KDF.m }

const PAYLOAD = {
  version: 2,
  folders: [
    {
      id: 'folder-1',
      name: 'Work',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ],
  notes: [
    {
      id: 'note-1',
      title: 'My account',
      body: 'user@example.com / hunter2',
      tags: ['account'],
      pinned: true,
      folderId: 'folder-1',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ],
}

/**
 * Flips the first base64 character of a value.
 *
 * The first base64 character always encodes the top six bits of the first
 * byte, so this always changes the decoded bytes. A naive
 * `value.replace(/^./, 'Z')` is a no-op when the character already is `Z`,
 * which made the tamper tests flaky (~1.5% of runs).
 */
function flipFirstChar(value: string): string {
  return (value.charAt(0) === 'A' ? 'B' : 'A') + value.slice(1)
}

describe('memex-crypto', () => {
  describe('production parameters', () => {
    it('uses the OWASP recommended Argon2id cost', () => {
      expect(ARGON2_PARAMS.m).toBe(19456)
      expect(ARGON2_PARAMS.t).toBe(2)
      expect(ARGON2_PARAMS.p).toBe(1)
      expect(ARGON2_PARAMS.dkLen).toBe(32)
    })

    it('refuses to import a file below the KDF memory floor', () => {
      expect(MIN_KDF_MEMORY).toBe(8192)
    })
  })

  describe('round trip', () => {
    it('decrypts back to the original payload', () => {
      const file = encryptMemexFile(PAYLOAD, 'correct horse', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const decrypted = decryptMemexFile(file, 'correct horse', FAST_OPTIONS)
      expect(decrypted).toEqual(PAYLOAD)
    })

    it('does not leak the note content into the ciphertext', () => {
      const file = encryptMemexFile(PAYLOAD, 'correct horse', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const serialised = serialiseMemexFile(file)
      expect(serialised).not.toContain('hunter2')
      expect(serialised).not.toContain('user@example.com')
      expect(serialised).not.toContain('correct horse')
      // Folder names are content too.
      expect(serialised).not.toContain('Work')
    })

    it('carries the folders through the round trip', () => {
      const file = encryptMemexFile(PAYLOAD, 'correct horse', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const decrypted = decryptMemexFile(file, 'correct horse', FAST_OPTIONS) as {
        folders: unknown[];
        notes: { folderId: string }[];
      }
      expect(decrypted.folders).toHaveLength(1)
      expect(decrypted.notes[0].folderId).toBe('folder-1')
    })

    it('survives a serialise / deserialise cycle', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const reparsed = deserialiseMemexFile(serialiseMemexFile(file))
      expect(reparsed.encrypted).toBe(true)
      if (reparsed.encrypted) {
        expect(decryptMemexFile(reparsed, 'pw', FAST_OPTIONS)).toEqual(PAYLOAD)
      }
    })

    it('uses a fresh salt and nonce for every export', () => {
      const a = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const b = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      expect(a.kdf.salt).not.toBe(b.kdf.salt)
      expect(a.cipher.nonce).not.toBe(b.cipher.nonce)
      expect(a.ciphertext).not.toBe(b.ciphertext)
    })

    it('produces a different ciphertext for the same password and payload', () => {
      const a = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const b = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      expect(a.ciphertext).not.toBe(b.ciphertext)
    })
  })

  describe('authentication failures', () => {
    it('rejects the wrong password', () => {
      const file = encryptMemexFile(PAYLOAD, 'right', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      expect(() => decryptMemexFile(file, 'wrong', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })

    it('rejects a tampered ciphertext', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const tampered = { ...file, ciphertext: flipFirstChar(file.ciphertext) }
      expect(() => decryptMemexFile(tampered, 'pw', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })

    it('rejects a tampered tag', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const tampered = {
        ...file,
        cipher: { ...file.cipher, tag: flipFirstChar(file.cipher.tag) },
      }
      expect(() => decryptMemexFile(tampered, 'pw', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })

    it('rejects a tampered nonce', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const tampered = {
        ...file,
        cipher: { ...file.cipher, nonce: flipFirstChar(file.cipher.nonce) },
      }
      expect(() => decryptMemexFile(tampered, 'pw', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })

    it('rejects a downgraded KDF cost in the header', () => {
      // The AAD binds the header, so lowering `m` must invalidate the tag.
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const downgraded = { ...file, kdf: { ...file.kdf, m: 8 } }
      expect(() => decryptMemexFile(downgraded, 'pw', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })

    it('rejects a tampered salt', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      const tampered = { ...file, kdf: { ...file.kdf, salt: flipFirstChar(file.kdf.salt) } }
      expect(() => decryptMemexFile(tampered, 'pw', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })

    it('rejects a file whose KDF cost is below the floor', () => {
      const weak = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', {
        kdf: { m: 64, t: 1, p: 1, dkLen: 32 },
      })
      expect(() => decryptMemexFile(weak, 'pw', { minKdfMemory: MIN_KDF_MEMORY })).toThrow(
        MemexDecryptError
      )
    })

    it('rejects an empty password', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      expect(() => decryptMemexFile(file, '', FAST_OPTIONS)).toThrow(MemexDecryptError)
    })
  })

  describe('file format', () => {
    it('writes the expected header', () => {
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      expect(file.format).toBe(MEMEX_FORMAT)
      expect(file.version).toBe(MEMEX_VERSION)
      expect(file.encrypted).toBe(true)
      expect(file.kdf.name).toBe('argon2id')
      expect(file.cipher.name).toBe('xchacha20poly1305')
      expect(file.exportedAt).toBe('2026-01-01T00:00:00.000Z')
    })

    it('rejects a file that is not a Memex file', () => {
      expect(() => parseMemexFile({ format: 'something-else' })).toThrow(MemexFormatError)
      expect(() => parseMemexFile(null)).toThrow(MemexFormatError)
      expect(() => parseMemexFile('nope')).toThrow(MemexFormatError)
    })

    it('rejects a file from a newer version', () => {
      expect(() =>
        parseMemexFile({ format: MEMEX_FORMAT, version: MEMEX_VERSION + 1, encrypted: false, notes: [] })
      ).toThrow(MemexFormatError)
    })

    it('accepts a v1 file (notes only, no folders)', () => {
      const v1 = {
        format: MEMEX_FORMAT,
        version: 1,
        encrypted: false,
        exportedAt: '2025-01-01T00:00:00.000Z',
        notes: [{ id: 'n1', title: 'Old', body: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1 }],
      }
      const parsed = parseMemexFile(v1)
      expect(parsed.encrypted).toBe(false)
      if (!parsed.encrypted) {
        expect(parsed.notes).toHaveLength(1)
      }
    })

    it('rejects a file older than v1', () => {
      expect(() =>
        parseMemexFile({ format: MEMEX_FORMAT, version: 0, encrypted: false, notes: [] })
      ).toThrow(MemexFormatError)
    })

    it('decrypts a v1 encrypted file written by an older build', () => {
      // A v1 file was encrypted with version 1 in the AAD. The current build
      // must still decrypt it, otherwise an existing vault becomes
      // unrecoverable after an update.
      const file = encryptMemexFile(
        { version: 1, notes: [{ id: 'n1', title: 'Old', body: '', tags: [], pinned: false, createdAt: 1, updatedAt: 1 }] },
        'pw',
        '2025-01-01T00:00:00.000Z',
        { ...FAST_OPTIONS, version: 1 }
      )
      expect(file.version).toBe(1)
      const decrypted = decryptMemexFile(file, 'pw', FAST_OPTIONS) as { notes: unknown[] }
      expect(decrypted.notes).toHaveLength(1)
    })

    it('rejects a file whose version was changed after encryption', () => {
      // The version is part of the AAD, so it cannot be rewritten.
      const file = encryptMemexFile(PAYLOAD, 'pw', '2026-01-01T00:00:00.000Z', FAST_OPTIONS)
      expect(() => decryptMemexFile({ ...file, version: 1 }, 'pw', FAST_OPTIONS)).toThrow(
        MemexDecryptError
      )
    })

    it('rejects an encrypted file that is missing its header', () => {
      expect(() =>
        parseMemexFile({ format: MEMEX_FORMAT, version: 1, encrypted: true })
      ).toThrow(MemexFormatError)
    })

    it('rejects invalid JSON', () => {
      expect(() => deserialiseMemexFile('{not json')).toThrow(MemexFormatError)
    })

    it('rejects an unsupported cipher', () => {
      expect(() =>
        parseMemexFile({
          format: MEMEX_FORMAT,
          version: 1,
          encrypted: true,
          kdf: { name: 'argon2id', salt: 'x', m: 19456, t: 2, p: 1, hashLen: 32 },
          cipher: { name: 'rot13', nonce: 'x', tag: 'x' },
          ciphertext: 'x',
        })
      ).toThrow(MemexFormatError)
    })
  })

  describe('plaintext export', () => {
    it('round-trips the notes without encryption', () => {
      const file = createPlaintextMemexFile(PAYLOAD, '2026-01-01T00:00:00.000Z')
      expect(file.encrypted).toBe(false)
      expect(file.notes).toEqual(PAYLOAD.notes)

      const reparsed = deserialiseMemexFile(serialiseMemexFile(file))
      expect(reparsed.encrypted).toBe(false)
      if (!reparsed.encrypted) {
        expect(reparsed.notes).toEqual(PAYLOAD.notes)
      }
    })

    it('is readable as plain text, which is the point of opting out', () => {
      const file = createPlaintextMemexFile(PAYLOAD)
      expect(serialiseMemexFile(file)).toContain('hunter2')
    })
  })
})
