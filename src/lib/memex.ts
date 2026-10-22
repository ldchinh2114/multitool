/**
 * Memex note/folder model and localStorage persistence.
 *
 * The vault lives entirely in this browser. Notes and folders are stored as a
 * plain JSON document under `kitbag-memex:notes` - this is a *document*, not a
 * cache, so it deliberately does not use the `kitbag-cache:` prefix or the
 * TTL helpers in `src/lib/api-cache.ts`.
 *
 * Encryption applies to the exported file (see `src/lib/memex-crypto.ts`),
 * not to what is sitting in localStorage. That is a deliberate trade-off
 * and it is documented in `docs/memex.md`.
 *
 * Every read and write is guarded: a full quota, a disabled storage or a
 * corrupted entry must degrade to "no saved notes", never to a crash.
 */

export const MEMEX_STORAGE_KEY = 'kitbag-memex:notes';

/**
 * The current document version.
 *
 * v1 was notes-only. v2 adds folders and the `folderId` field on a note.
 * Older documents are still readable - see `sanitiseDocument`.
 */
export const MEMEX_FORMAT_VERSION = 2;

/** Maximum number of tags on a single note. */
export const MAX_TAGS = 16;

/** Maximum length of a folder name. */
export const MAX_FOLDER_NAME = 60;

/** A note that does not belong to any folder. */
export const UNFILED = null;

export interface MemexFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemexNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  /** `null` means the note is not filed in any folder. */
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MemexDocument {
  version: number;
  folders: MemexFolder[];
  notes: MemexNote[];
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Creates a unique id.
 *
 * `crypto.randomUUID` needs a secure context, so a plain-http LAN origin
 * falls back to `crypto.getRandomValues`.
 */
export function createId(): string {
  const cryptoApi = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Last resort - not cryptographically random, but it only has to be unique.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalises a tag: trimmed, lowercased, de-duplicated, length-capped.
 */
export function normaliseTag(tag: string): string {
  return tag.trim().toLowerCase().slice(0, 32);
}

/**
 * Normalises a tag list: trims, lowercases, drops empties, de-duplicates and
 * caps the count at `MAX_TAGS`.
 */
export function normaliseTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalised = normaliseTag(tag);
    if (normalised) seen.add(normalised);
    if (seen.size >= MAX_TAGS) break;
  }
  return Array.from(seen);
}

/**
 * Parses a comma separated tag string into a normalised tag list.
 */
export function parseTagInput(value: string): string[] {
  return normaliseTags(value.split(','));
}

/** Normalises a folder name: trimmed, collapsed whitespace, length-capped. */
export function normaliseFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_FOLDER_NAME);
}

/** Builds a fresh, empty note. */
export function createEmptyNote(folderId: string | null = UNFILED): MemexNote {
  const now = Date.now();
  return {
    id: createId(),
    title: '',
    body: '',
    tags: [],
    pinned: false,
    folderId,
    createdAt: now,
    updatedAt: now,
  };
}

/** Builds a fresh, empty folder. */
export function createEmptyFolder(name = ''): MemexFolder {
  const now = Date.now();
  return {
    id: createId(),
    name: normaliseFolderName(name),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Coerces an unknown value into a valid note.
 *
 * Used when reading from storage or importing a file, so a malformed entry
 * is dropped rather than crashing the page. A note without a `folderId` (a
 * v1 document) is filed as unfiled.
 */
export function sanitiseNote(value: unknown): MemexNote | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<MemexNote>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;

  const now = Date.now();
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    tags: Array.isArray(raw.tags)
      ? normaliseTags(raw.tags.filter((t): t is string => typeof t === 'string'))
      : [],
    pinned: raw.pinned === true,
    folderId: typeof raw.folderId === 'string' && raw.folderId.length > 0 ? raw.folderId : UNFILED,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

/**
 * Coerces an unknown value into a valid folder.
 */
export function sanitiseFolder(value: unknown): MemexFolder | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<MemexFolder>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;

  const now = Date.now();
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? normaliseFolderName(raw.name) : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

/**
 * Coerces an unknown value into a valid vault document.
 *
 * Accepts a v1 document (notes only, no folders) and a v2 document. A note
 * that references a folder that does not exist is filed as unfiled, so a
 * hand-edited or partially corrupted file cannot make a note unreachable.
 */
export function sanitiseDocument(value: unknown): MemexDocument {
  const raw = value as Partial<MemexDocument> | null;

  const folders = Array.isArray(raw?.folders)
    ? raw.folders.map(sanitiseFolder).filter((f): f is MemexFolder => f !== null)
    : [];

  const knownFolderIds = new Set(folders.map((f) => f.id));

  const notes = Array.isArray(raw?.notes)
    ? raw.notes
        .map(sanitiseNote)
        .filter((note): note is MemexNote => note !== null)
        .map((note) =>
          note.folderId !== UNFILED && !knownFolderIds.has(note.folderId)
            ? { ...note, folderId: UNFILED }
            : note
        )
    : [];

  return { version: MEMEX_FORMAT_VERSION, folders, notes };
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/* ------------------------------------------------------------------ */

/** Reads the vault from localStorage. Returns an empty vault on any failure. */
export function loadVault(): MemexDocument {
  if (!isBrowser()) return { version: MEMEX_FORMAT_VERSION, folders: [], notes: [] };
  try {
    const raw = window.localStorage.getItem(MEMEX_STORAGE_KEY);
    if (!raw) return { version: MEMEX_FORMAT_VERSION, folders: [], notes: [] };
    return sanitiseDocument(JSON.parse(raw));
  } catch {
    return { version: MEMEX_FORMAT_VERSION, folders: [], notes: [] };
  }
}

/** Writes the vault to localStorage. Failures are ignored on purpose. */
export function saveVault(folders: MemexFolder[], notes: MemexNote[]): void {
  if (!isBrowser()) return;
  try {
    const document: MemexDocument = {
      version: MEMEX_FORMAT_VERSION,
      folders,
      notes,
    };
    window.localStorage.setItem(MEMEX_STORAGE_KEY, JSON.stringify(document));
  } catch {
    /* quota exceeded or storage disabled - the app still works in memory */
  }
}

/** Removes the vault from localStorage entirely. */
export function clearStoredVault(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(MEMEX_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* ordering                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sorts notes for display: pinned first, then most recently updated.
 */
export function sortNotes(notes: MemexNote[]): MemexNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

/** Sorts folders alphabetically, case-insensitively. */
export function sortFolders(folders: MemexFolder[]): MemexFolder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/* ------------------------------------------------------------------ */
/* folder helpers                                                      */
/* ------------------------------------------------------------------ */

/** The notes filed in a folder. `null` selects the unfiled notes. */
export function notesInFolder(notes: MemexNote[], folderId: string | null): MemexNote[] {
  return sortNotes(notes.filter((note) => note.folderId === folderId));
}

/** How many notes are in each folder, plus how many are unfiled. */
export function countNotes(notes: MemexNote[]): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const note of notes) {
    counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1);
  }
  return counts;
}

/** Moves a note into a folder (or out of every folder when `folderId` is null). */
export function moveNoteToFolder(
  notes: MemexNote[],
  noteId: string,
  folderId: string | null
): MemexNote[] {
  return notes.map((note) =>
    note.id === noteId ? { ...note, folderId, updatedAt: Date.now() } : note
  );
}

/**
 * Deletes a folder.
 *
 * The notes inside it are **not** deleted - they become unfiled, so a
 * mis-click cannot destroy data. The caller is responsible for telling the
 * user this.
 */
export function deleteFolder(
  folders: MemexFolder[],
  notes: MemexNote[],
  folderId: string
): { folders: MemexFolder[]; notes: MemexNote[] } {
  return {
    folders: folders.filter((folder) => folder.id !== folderId),
    notes: notes.map((note) =>
      note.folderId === folderId ? { ...note, folderId: UNFILED, updatedAt: Date.now() } : note
    ),
  };
}

/* ------------------------------------------------------------------ */
/* import modes                                                        */
/* ------------------------------------------------------------------ */

export interface MergeResult {
  notes: MemexNote[];
  added: number;
  skipped: number;
}

/**
 * Merges imported notes into the existing ones.
 *
 * A note whose `id` is already present is skipped, so importing the same file
 * twice does not create duplicates. Folders are merged the same way: an
 * imported folder with a new id is added, an existing id is kept as-is.
 */
export function mergeNotes(existing: MemexNote[], imported: MemexNote[]): MergeResult {
  const known = new Set(existing.map((note) => note.id));
  const notes = [...existing];
  let added = 0;
  let skipped = 0;

  for (const note of imported) {
    if (known.has(note.id)) {
      skipped += 1;
      continue;
    }
    known.add(note.id);
    notes.push(note);
    added += 1;
  }

  return { notes, added, skipped };
}

/**
 * Merges imported folders into the existing ones, keeping the existing
 * folder when the id already exists.
 */
export function mergeFolders(
  existing: MemexFolder[],
  imported: MemexFolder[]
): { folders: MemexFolder[]; added: number } {
  const known = new Set(existing.map((folder) => folder.id));
  const folders = [...existing];
  let added = 0;

  for (const folder of imported) {
    if (known.has(folder.id)) continue;
    known.add(folder.id);
    folders.push(folder);
    added += 1;
  }

  return { folders, added };
}
