/**
 * Memex crypto: Argon2id KDF + XChaCha20-Poly1305 AEAD.
 *
 * The export format is documented in `docs/memex.md`. This module owns the
 * file container, the key derivation and the authenticated encryption.
 *
 * Design notes that matter:
 *
 * - **Argon2id** (not PBKDF2) is memory-hard, so a GPU cannot brute-force a
 *   password at the rate a plain hash iteration would allow. Parameters
 *   follow the OWASP Password Storage Cheat Sheet: m = 19 MiB, t = 2, p = 1.
 * - **XChaCha20-Poly1305** has a 192-bit nonce, so a random nonce per export
 *   is safe - there is no birthday bound to hit at this volume. The Poly1305
 *   tag authenticates the ciphertext, so a tampered file fails to decrypt
 *   instead of yielding garbage.
 * - **The header is bound to the ciphertext with AAD.** The KDF parameters
 *   live in the file header, so without this an attacker could rewrite
 *   `m`/`t` down to something trivial and re-encrypt under a weaker
 *   derivation. Recomputing the AAD from the header on import means any
 *   change to the header - including the KDF cost - fails the tag check.
 * - **The key is derived per export**, never cached and never derived from a
 *   stored secret, so two files exported with the same password share no key
 *   material.
 *
 * Nothing here logs. No note content and no password may ever reach the
 * console, an exception message, or a log sink.
 */

import { argon2id } from '@noble/hashes/argon2.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';

export const MEMEX_FORMAT = 'kitbag-memex';

/**
 * The current file format version.
 *
 * v1 was notes-only. v2 adds folders. A v1 file is still importable - the
 * folders are simply empty and its notes become unfiled.
 */
export const MEMEX_VERSION = 2;

/** The oldest file version this build can read. */
export const MEMEX_MIN_VERSION = 1;

/** OWASP recommended Argon2id cost. ~19 MiB of memory, 2 iterations. */
export const ARGON2_PARAMS = {
  t: 2,
  m: 19456, // KiB
  p: 1,
  dkLen: 32,
} as const;

/**
 * The weakest KDF cost an imported file is allowed to use.
 *
 * The AAD already binds the header to the ciphertext, so a file cannot have
 * its KDF cost changed without invalidating the tag. This floor is the second
 * line of defence: it rejects a file that was *authored* with a deliberately
 * weak cost, which would make an offline brute force of that file cheap.
 */
export const MIN_KDF_MEMORY = 8192; // KiB

const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;

/**
 * Overrides for the crypto parameters.
 *
 * The defaults are the production values. Tests pass a much smaller memory
 * cost so the suite stays fast - Argon2id is deliberately expensive.
 */
export interface MemexCryptoOptions {
  /** KDF cost used when encrypting. Defaults to `ARGON2_PARAMS`. */
  kdf?: { m: number; t: number; p: number; dkLen: number };
  /** Weakest KDF memory cost accepted when decrypting. Defaults to `MIN_KDF_MEMORY`. */
  minKdfMemory?: number;
  /**
   * The file format version to write. Defaults to `MEMEX_VERSION`.
   *
   * The version is part of the AAD, so a file written as v1 is only
   * decryptable by a build that also writes v1 - which is exactly what the
   * backwards-compatibility test needs.
   */
  version?: number;
}

export interface MemexKdfParams {
  name: 'argon2id';
  salt: string;
  m: number;
  t: number;
  p: number;
  hashLen: number;
}

export interface MemexCipherParams {
  name: 'xchacha20poly1305';
  nonce: string;
  tag: string;
}

/** The on-disk shape of an encrypted export. */
export interface EncryptedMemexFile {
  format: typeof MEMEX_FORMAT;
  version: number;
  encrypted: true;
  exportedAt: string;
  kdf: MemexKdfParams;
  cipher: MemexCipherParams;
  ciphertext: string;
}

/** The on-disk shape of a plaintext export. */
export interface PlaintextMemexFile {
  format: typeof MEMEX_FORMAT;
  version: number;
  encrypted: false;
  exportedAt: string;
  folders: unknown[];
  notes: unknown[];
}

export type MemexFile = EncryptedMemexFile | PlaintextMemexFile;

/** Thrown for any failure that means "wrong password or damaged file". */
export class MemexDecryptError extends Error {
  constructor(message = 'Wrong password or the file is damaged') {
    super(message);
    this.name = 'MemexDecryptError';
  }
}

/** Thrown when the file is not a Memex file at all. */
export class MemexFormatError extends Error {
  constructor(message = 'This is not a Memex file') {
    super(message);
    this.name = 'MemexFormatError';
  }
}

/* ------------------------------------------------------------------ */
/* base64 helpers - avoid `btoa`/`atob` so the code works in Node too */
/* ------------------------------------------------------------------ */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(value, 'base64'));
}

/* ------------------------------------------------------------------ */
/* key derivation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Derives the encryption key from a password and a salt.
 *
 * The salt is 16 random bytes and is stored in the file - it is not secret,
 * it only makes two exports with the same password use different keys.
 */
export function deriveKey(
  password: string,
  salt: Uint8Array,
  params: { m: number; t: number; p: number; dkLen: number } = ARGON2_PARAMS
): Uint8Array {
  if (password.length === 0) {
    throw new Error('A password is required');
  }
  if (salt.length < 8) {
    throw new Error('Salt must be at least 8 bytes');
  }
  return argon2id(password, salt, {
    t: params.t,
    m: params.m,
    p: params.p,
    dkLen: params.dkLen,
  });
}

/** Overwrites a key buffer in place. Best effort - JS strings cannot be zeroed. */
function wipeKey(key: Uint8Array): void {
  key.fill(0);
}

/* ------------------------------------------------------------------ */
/* AAD - binds the file header to the ciphertext                       */
/* ------------------------------------------------------------------ */

/**
 * Builds the additional authenticated data from the file header.
 *
 * Only the fields that must not change are included. `ciphertext`, the tag
 * and `exportedAt` are excluded on purpose: the tag is part of the
 * ciphertext and the timestamp is informational.
 *
 * The exact JSON text must be reproducible byte-for-byte on import, so the
 * field order here is fixed and must not be changed without bumping
 * `MEMEX_VERSION`.
 */
function buildAad(header: {
  format: string;
  version: number;
  encrypted: boolean;
  kdf: MemexKdfParams;
  cipher: Omit<MemexCipherParams, 'tag'>;
}): Uint8Array {
  const canonical = JSON.stringify({
    format: header.format,
    version: header.version,
    encrypted: header.encrypted,
    kdf: {
      name: header.kdf.name,
      salt: header.kdf.salt,
      m: header.kdf.m,
      t: header.kdf.t,
      p: header.kdf.p,
      hashLen: header.kdf.hashLen,
    },
    cipher: {
      name: header.cipher.name,
      nonce: header.cipher.nonce,
    },
  });
  return new TextEncoder().encode(canonical);
}

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

/**
 * Encrypts a payload with a password and returns the file container.
 *
 * @param payload - Any JSON-serialisable value (the notes document).
 * @param password - The user's password. Never stored, never logged.
 * @param exportedAt - ISO timestamp for the header.
 */
export function encryptMemexFile(
  payload: unknown,
  password: string,
  exportedAt: string = new Date().toISOString(),
  options: MemexCryptoOptions = {}
): EncryptedMemexFile {
  const params = options.kdf ?? ARGON2_PARAMS;
  const version = options.version ?? MEMEX_VERSION;
  const salt = randomBytes(SALT_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);

  const kdf: MemexKdfParams = {
    name: 'argon2id',
    salt: bytesToBase64(salt),
    m: params.m,
    t: params.t,
    p: params.p,
    hashLen: params.dkLen,
  };

  const cipherHeader = {
    name: 'xchacha20poly1305' as const,
    nonce: bytesToBase64(nonce),
  };

  const aad = buildAad({
    format: MEMEX_FORMAT,
    version,
    encrypted: true,
    kdf,
    cipher: cipherHeader,
  });

  const key = deriveKey(password, salt, params);
  try {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    // `encrypt` returns ciphertext || tag; the tag is split out for the header
    // so the container keeps them in separate fields.
    const sealed = xchacha20poly1305(key, nonce, aad).encrypt(plaintext);
    const tagLength = 16;
    const ciphertext = sealed.subarray(0, sealed.length - tagLength);
    const tag = sealed.subarray(sealed.length - tagLength);

    return {
      format: MEMEX_FORMAT,
      version,
      encrypted: true,
      exportedAt,
      kdf,
      cipher: { ...cipherHeader, tag: bytesToBase64(tag) },
      ciphertext: bytesToBase64(ciphertext),
    };
  } finally {
    wipeKey(key);
  }
}

/**
 * Builds a plaintext (unencrypted) export container.
 *
 * Only reachable when the user explicitly opts out of a password.
 */
export function createPlaintextMemexFile(
  payload: unknown,
  exportedAt: string = new Date().toISOString()
): PlaintextMemexFile {
  const source = (payload ?? {}) as { folders?: unknown[]; notes?: unknown[] };
  return {
    format: MEMEX_FORMAT,
    version: MEMEX_VERSION,
    encrypted: false,
    exportedAt,
    folders: Array.isArray(source.folders) ? source.folders : [],
    notes: Array.isArray(source.notes) ? source.notes : [],
  };
}

/* ------------------------------------------------------------------ */
/* import                                                              */
/* ------------------------------------------------------------------ */

/** Narrows an unknown parsed value to a Memex file container. */
export function parseMemexFile(raw: unknown): MemexFile {
  if (!raw || typeof raw !== 'object') {
    throw new MemexFormatError();
  }
  const file = raw as Partial<EncryptedMemexFile> | Partial<PlaintextMemexFile>;

  if (file.format !== MEMEX_FORMAT) {
    throw new MemexFormatError();
  }
  if (typeof file.version !== 'number') {
    throw new MemexFormatError('Unsupported Memex file version');
  }
  if (file.version > MEMEX_VERSION) {
    throw new MemexFormatError(
      'This file was created by a newer version of Memex'
    );
  }
  if (file.version < MEMEX_MIN_VERSION) {
    throw new MemexFormatError('Unsupported Memex file version');
  }

  if (file.encrypted === false) {
    if (!Array.isArray(file.notes)) {
      throw new MemexFormatError('The file does not contain a notes list');
    }
    return file as PlaintextMemexFile;
  }

  if (file.encrypted !== true) {
    throw new MemexFormatError();
  }
  if (!file.kdf || !file.cipher || typeof file.ciphertext !== 'string') {
    throw new MemexFormatError('The encrypted file is missing its header');
  }
  if (file.kdf.name !== 'argon2id' || file.cipher.name !== 'xchacha20poly1305') {
    throw new MemexFormatError('Unsupported encryption parameters');
  }
  return file as EncryptedMemexFile;
}

/**
 * Decrypts an encrypted Memex file and returns the payload.
 *
 * Any failure - wrong password, tampered header, tampered ciphertext - is
 * reported as a `MemexDecryptError`, so the tool cannot be used as an oracle
 * to tell "wrong password" from "modified file".
 */
export function decryptMemexFile(
  file: EncryptedMemexFile,
  password: string,
  options: MemexCryptoOptions = {}
): unknown {
  const minKdfMemory = options.minKdfMemory ?? MIN_KDF_MEMORY;

  // An empty password must fail exactly like a wrong one, so it is reported
  // as a `MemexDecryptError` rather than a distinct error.
  if (password.length === 0) {
    throw new MemexDecryptError();
  }

  // Reject a file that was authored with a KDF cost below the floor. The AAD
  // already binds the header, so this only rejects files that were *created*
  // with a deliberately weak cost - which would make an offline brute force
  // of that file cheap.
  if (
    !Number.isFinite(file.kdf.m) ||
    file.kdf.m < minKdfMemory ||
    !Number.isFinite(file.kdf.t) ||
    file.kdf.t < 1 ||
    !Number.isFinite(file.kdf.p) ||
    file.kdf.p < 1 ||
    file.kdf.hashLen < 16
  ) {
    throw new MemexDecryptError(
      'This file uses a weaker encryption setting than Memex allows'
    );
  }

  let salt: Uint8Array;
  let nonce: Uint8Array;
  let expectedTag: Uint8Array;
  let ciphertext: Uint8Array;

  try {
    salt = base64ToBytes(file.kdf.salt);
    nonce = base64ToBytes(file.cipher.nonce);
    expectedTag = base64ToBytes(file.cipher.tag);
    ciphertext = base64ToBytes(file.ciphertext);
  } catch {
    throw new MemexDecryptError();
  }

  if (
    salt.length !== SALT_LENGTH ||
    nonce.length !== NONCE_LENGTH ||
    expectedTag.length !== 16
  ) {
    throw new MemexDecryptError();
  }

  // The AAD is rebuilt from the header, so a modified KDF cost or a modified
  // nonce fails the tag check exactly like a wrong password does.
  const aad = buildAad({
    format: file.format,
    version: file.version,
    encrypted: true,
    kdf: file.kdf,
    cipher: { name: file.cipher.name, nonce: file.cipher.nonce },
  });

  const key = (() => {
    try {
      return deriveKey(password, salt, {
        m: file.kdf.m,
        t: file.kdf.t,
        p: file.kdf.p,
        dkLen: file.kdf.hashLen,
      });
    } catch {
      // A key derivation failure (bad parameters, an allocation failure) is
      // indistinguishable from a wrong password as far as the user is
      // concerned, so it is reported the same way.
      throw new MemexDecryptError();
    }
  })();

  try {
    // Re-attach the tag: the cipher expects ciphertext || tag.
    const sealed = new Uint8Array(ciphertext.length + expectedTag.length);
    sealed.set(ciphertext, 0);
    sealed.set(expectedTag, ciphertext.length);

    const plaintext = xchacha20poly1305(key, nonce, aad).decrypt(sealed);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new MemexDecryptError();
  } finally {
    wipeKey(key);
  }
}

/** Serialises a file container to the text that is written to disk. */
export function serialiseMemexFile(file: MemexFile): string {
  return JSON.stringify(file, null, 2);
}

/** Parses the text read from disk into a validated file container. */
export function deserialiseMemexFile(text: string): MemexFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MemexFormatError('The file is not valid JSON');
  }
  return parseMemexFile(raw);
}
