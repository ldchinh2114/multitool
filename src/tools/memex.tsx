'use client';


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  FileUp,
  Folder,
  FolderPlus,
  List,
  Loader2,
  Lock,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguage } from '@/lib/language-context';
import {
  MEMEX_STORAGE_KEY,
  UNFILED,
  type MemexFolder,
  type MemexNote,
  clearStoredVault,
  countNotes,
  createEmptyFolder,
  createEmptyNote,
  deleteFolder as deleteFolderFromVault,
  loadVault,
  mergeFolders,
  mergeNotes,
  moveNoteToFolder,
  normaliseFolderName,
  notesInFolder,
  parseTagInput,
  sanitiseDocument,
  saveVault,
  sortFolders,
  sortNotes,
} from '@/lib/memex';
import {
  MemexDecryptError,
  MemexFormatError,
  type EncryptedMemexFile,
  createPlaintextMemexFile,
  decryptMemexFile,
  deserialiseMemexFile,
  encryptMemexFile,
  serialiseMemexFile,
} from '@/lib/memex-crypto';

/**
 * Attributes applied to every field that can hold user content.
 *
 * `autocomplete="off"` stops the browser from filling a field from its own
 * autofill store, and the `data-1p-ignore` / `data-lpignore` family stops
 * password managers from capturing or auto-filling it. None of this stops an
 * OS-level keylogger - see `docs/memex.md` - it only removes the accidental
 * storage of a secret somewhere it should not be.
 */
const SAFE_INPUT = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const;

/** Minimum length for an export password. */
const MIN_PASSWORD_LENGTH = 8;

/** How long a note stays in the undo buffer, in ms. */
const UNDO_TIMEOUT = 8000;

/** How long a non-undo toast stays on screen, in ms. */
const TOAST_TIMEOUT = 4000;

/** Delay before the vault is written to localStorage, in ms. */
const SAVE_DEBOUNCE = 400;

/** The file extension used for each kind of export. */
const EXPORT_EXTENSION = {
  encrypted: '.memex',
  plaintext: '.memex.json',
} as const;

/**
 * Whether the browser can produce the random bytes the crypto needs.
 *
 * The salt and the nonce come from `crypto.getRandomValues`. A browser
 * without it cannot encrypt anything safely, so the tool says so instead of
 * failing halfway through an export.
 */
function hasSecureRandom(): boolean {
  if (typeof globalThis.crypto === 'undefined') return false;
  return typeof globalThis.crypto.getRandomValues === 'function';
}

/**
 * The File System Access API's save picker.
 *
 * `showSaveFilePicker` is not in TypeScript's DOM lib yet, so it is typed
 * locally rather than added to the global `Window` interface. It is only
 * available in Chromium browsers and needs a secure context.
 */
interface MemexFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  /**
   * Deletes the file. Available on a handle from the save picker in Chromium
   * 110+, but optional here because it is newer than the picker itself.
   */
  remove?: () => Promise<void>;
}

type MemexSaveFilePicker = (options?: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<MemexFileHandle>;

/**
 * Returns the save picker, or `null` when the browser does not support it.
 *
 * Guarded for the server: the component is prerendered, so `window` does
 * not exist during the build.
 */
function getSaveFilePicker(): MemexSaveFilePicker | null {
  if (typeof window === 'undefined') return null;
  const picker = (window as unknown as { showSaveFilePicker?: MemexSaveFilePicker })
    .showSaveFilePicker;
  return typeof picker === 'function' ? picker.bind(window) : null;
}

/**
 * True when the browser aborted the picker because the user cancelled.
 *
 * Only `AbortError` counts. A `NotAllowedError` means the browser refused
 * permission, which is a failure the user should hear about - treating it
 * as a cancel would silently drop the export.
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Strips the characters that are illegal in a file name, on any platform.
 *
 * A name is a *name*, never a path - the location is chosen by the user in
 * the save dialog.
 */
function sanitiseFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 80);
}

/**
 * Builds the final file name, always with the right extension.
 *
 * A name the user typed as `my vault` becomes `my vault.memex`; a name they
 * typed as `my vault.memex` is left alone; `my vault.memex.json` becomes
 * `my vault.memex` for an encrypted export and stays for a plain one.
 */
function buildExportFileName(base: string, encrypted: boolean): string {
  const extension = encrypted ? EXPORT_EXTENSION.encrypted : EXPORT_EXTENSION.plaintext;
  const cleaned = sanitiseFileName(base);
  const stem = cleaned.replace(/\.memex(\.json)?$/i, '');
  return `${stem || `memex-${fileNameStamp()}`}${extension}`;
}

type Dialog = 'none' | 'export' | 'import' | 'deleteAll' | 'newFolder' | 'deleteFolder';

interface ImportPayload {
  notes: MemexNote[];
  folders: MemexFolder[];
  encrypted: boolean;
}

/**
 * Downloads a text file. The object URL is revoked immediately after the
 * click, so nothing is left dangling.
 */
function downloadTextFile(fileName: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Writes the export to the file the user chose with the save picker.
 *
 * A transient lock (a sync client, an antivirus scanner) can make the first
 * attempt fail even though the location is fine, so it is retried once. A
 * retry truncates the file again and writes it from scratch, so a half-written
 * first attempt is never kept.
 */
async function writeExportToHandle(handle: MemexFileHandle, text: string) {
  const bytes = new TextEncoder().encode(text);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/** Builds a sortable file name, e.g. `memex-2026-10-22-0914`. */
function fileNameStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('');
}

/** The file extension for an export. */
function extensionOf(encrypted: boolean): string {
  return encrypted ? EXPORT_EXTENSION.encrypted : EXPORT_EXTENSION.plaintext;
}

/**
 * A small modal shell. Rendered inline rather than through a portal - the
 * tool has no other overlays, and the page is short enough that this is
 * simpler to reason about.
 */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** One row in the folder tree: a note belonging to the current folder. */
function NoteRow({
  note,
  selected,
  onSelect,
}: {
  note: MemexNote;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLanguage();
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500/50',
          selected ? 'bg-cyan-50 ring-1 ring-cyan-200' : 'hover:bg-gray-50'
        )}
      >
        {note.pinned && <Pin className="h-3 w-3 shrink-0 text-cyan-600" />}
        <span className="truncate text-sm text-gray-800">
          {note.title || t('memexNoteTitlePlaceholder')}
        </span>
      </button>
    </li>
  );
}

function MemexContent() {
  const { t } = useLanguage();

  const [folders, setFolders] = useState<MemexFolder[]>([]);
  const [notes, setNotes] = useState<MemexNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  /** The folder whose notes are shown in the main pane. `null` = all notes. */
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>('none');
  const [locked, setLocked] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState<{ message: string; canUndo: boolean } | null>(null);

  // Export dialog state
  const [password, setPassword] = useState('');
  const [withoutPassword, setWithoutPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  /** True while the browser's native "save as" dialog is open. */
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const [exportError, setExportError] = useState('');

  /** `grouped` shows the folder tree; `flat` lists every note in one list. */
  const [view, setView] = useState<'grouped' | 'flat'>('grouped');

  // Import dialog state
  const [importPayload, setImportPayload] = useState<ImportPayload | null>(null);
  const [pendingEncryptedFile, setPendingEncryptedFile] =
    useState<EncryptedMemexFile | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Folder dialog state
  const [folderName, setFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<MemexFolder | null>(null);

  /**
   * Whether the browser can ask the user where to save the file.
   *
   * Read after mount rather than during render: the component is
   * prerendered, so `window` does not exist on the server, and reading it
   * during render would also cause a hydration mismatch on the hint text.
   * The export dialog can only be opened after hydration anyway.
   */
  const [canPickLocation, setCanPickLocation] = useState(false);
  useEffect(() => {
    setCanPickLocation(getSaveFilePicker() !== null);
  }, []);

  /**
   * Whether the browser can do the crypto at all.
   *
   * Read after mount for the same reason as `canPickLocation`: the component
   * is prerendered and `crypto` may not exist on the server.
   */
  const [canEncrypt, setCanEncrypt] = useState(true);
  useEffect(() => {
    setCanEncrypt(hasSecureRandom());
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const vaultRef = useRef<{ folders: MemexFolder[]; notes: MemexNote[] }>({
    folders: [],
    notes: [],
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoBuffer = useRef<MemexNote[] | null>(null);
  /**
   * Guards the async export continuation. The export can still be running
   * when the page is left (or reloaded by Fast Refresh), and setting state
   * on an unmounted component is an error in React 19.
   */
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* persistence                                                       */
  /* ---------------------------------------------------------------- */

  /** Queues a debounced write of the given vault to localStorage. */
  const persist = useCallback(
    (nextFolders: MemexFolder[], nextNotes: MemexNote[]) => {
      vaultRef.current = { folders: nextFolders, notes: nextNotes };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveVault(vaultRef.current.folders, vaultRef.current.notes);
      }, SAVE_DEBOUNCE);
    },
    []
  );

  // Load the vault once, after hydration.
  useEffect(() => {
    const stored = loadVault();
    vaultRef.current = { folders: stored.folders, notes: stored.notes };
    setFolders(stored.folders);
    setNotes(stored.notes);
    setIsLoaded(true);
  }, []);

  // Flush any pending write when the tool unmounts.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveVault(vaultRef.current.folders, vaultRef.current.notes);
      }
    };
  }, []);

  // Flush any pending write when the page is hidden or closed. The write is
  // debounced, so without this a reload within 400 ms of a change loses it.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      saveVault(vaultRef.current.folders, vaultRef.current.notes);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  /** Replaces the vault and schedules a write. */
  const commit = useCallback(
    (nextFolders: MemexFolder[], nextNotes: MemexNote[]) => {
      setFolders(nextFolders);
      setNotes(nextNotes);
      persist(nextFolders, nextNotes);
    },
    [persist]
  );

  /**
   * Shows a toast and schedules its dismissal.
   *
   * Every toast has to be dismissed on a timer. A toast that stays on screen
   * is actively misleading: an old "Imported 0 notes" message left over from
   * an earlier attempt reads as the result of the current one.
   */
  const showToast = useCallback((message: string, canUndo: boolean) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setToast({ message, canUndo });
    undoTimer.current = setTimeout(() => {
      setToast(null);
      undoBuffer.current = null;
    }, canUndo ? UNDO_TIMEOUT : TOAST_TIMEOUT);
  }, []);

  /* ---------------------------------------------------------------- */
  /* locking                                                           */
  /* ---------------------------------------------------------------- */

  // Hide the notes when the tab is hidden or the window loses focus. This is
  // about shoulder-surfing and about not leaving secrets sitting in a
  // background tab - not about keyloggers, which a page cannot stop.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') setLocked(true);
    };
    const onBlur = () => setLocked(true);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /** Opens a dialog. Opening one always unlocks the vault, because the user
   *  just interacted with the page. */
  const openDialog = useCallback((next: Dialog) => {
    setLocked(false);
    setDialog(next);
  }, []);

  /* ---------------------------------------------------------------- */
  /* derived data                                                      */
  /* ---------------------------------------------------------------- */

  const orderedFolders = useMemo(() => sortFolders(folders), [folders]);
  const noteCounts = useMemo(() => countNotes(notes), [notes]);

  /**
   * The notes that match the search term.
   *
   * The search applies to the sidebar tree as well as the main list -
   * otherwise typing a term would still leave every other note visible in
   * the tree, which makes the search look broken.
   */
  const searchedNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.includes(needle))
    );
  }, [notes, query]);

  /**
   * The notes shown in the main pane.
   *
   * A note that lives in a folder is **not** listed here - the user has to
   * open that folder to see it. Only unfiled notes show up by default, and
   * the flat view is the explicit way to see everything at once.
   */
  const visibleNotes = useMemo(() => {
    if (view === 'flat') return sortNotes(searchedNotes);
    if (activeFolderId !== null) {
      return sortNotes(searchedNotes.filter((note) => note.folderId === activeFolderId));
    }
    return sortNotes(searchedNotes.filter((note) => note.folderId === UNFILED));
  }, [searchedNotes, activeFolderId, view]);

  const unfiledNotes = useMemo(
    () => sortNotes(searchedNotes.filter((note) => note.folderId === UNFILED)),
    [searchedNotes]
  );

  /** How many notes are filed in a folder, i.e. hidden until the folder opens. */
  const filedNoteCount = useMemo(
    () => notes.filter((note) => note.folderId !== UNFILED).length,
    [notes]
  );

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId) ?? null,
    [folders, activeFolderId]
  );

  const isEmptyVault = folders.length === 0 && notes.length === 0;

  /* ---------------------------------------------------------------- */
  /* notes                                                             */
  /* ---------------------------------------------------------------- */

  const handleCreateNote = (folderId: string | null = UNFILED) => {
    const note = createEmptyNote(folderId);
    commit(folders, [note, ...notes]);
    setSelectedNoteId(note.id);
    setQuery('');
  };

  const handleUpdateNote = (id: string, patch: Partial<MemexNote>) => {
    const now = Date.now();
    const next = notes.map((note) =>
      note.id === id ? { ...note, ...patch, updatedAt: now } : note
    );
    commit(folders, next);
  };

  const handleTogglePin = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    handleUpdateNote(id, { pinned: !note.pinned });
  };

  const handleMoveNote = (id: string, folderId: string | null) => {
    commit(folders, moveNoteToFolder(notes, id, folderId));
  };

  const handleDeleteNote = (id: string) => {
    const removed = notes.filter((note) => note.id === id);
    if (removed.length === 0) return;

    undoBuffer.current = removed;
    commit(folders, notes.filter((note) => note.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);

    showToast(t('memexNoteDeleted'), true);
  };

  const handleUndoDelete = () => {
    const buffer = undoBuffer.current;
    if (!buffer) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoBuffer.current = null;
    setToast(null);
    commit(folders, [...notes, ...buffer]);
    // Re-open the restored note so undo feels like the delete never happened.
    if (buffer.length === 1) setSelectedNoteId(buffer[0].id);
  };

  const handleDeleteAll = () => {
    clearStoredVault();
    commit([], []);
    setSelectedNoteId(null);
    setActiveFolderId(null);
    setDialog('none');
    showToast(t('memexDeleteAllDone'), false);
  };

  /* ---------------------------------------------------------------- */
  /* folders                                                           */
  /* ---------------------------------------------------------------- */

  const handleCreateFolder = () => {
    const name = normaliseFolderName(folderName);
    if (!name) return;
    const folder = createEmptyFolder(name);
    commit([...folders, folder], notes);
    // The folder is opened, but its notes stay hidden in the tree until the
    // user expands it - the tree only ever shows what was asked for.
    setActiveFolderId(folder.id);
    setSelectedNoteId(null);
    setFolderName('');
    setDialog('none');
    showToast(t('memexFolderCreated'), false);
  };

  const handleDeleteFolder = () => {
    if (!folderToDelete) return;
    const result = deleteFolderFromVault(folders, notes, folderToDelete.id);
    commit(result.folders, result.notes);
    if (activeFolderId === folderToDelete.id) setActiveFolderId(null);
    setFolderToDelete(null);
    setDialog('none');
    showToast(t('memexFolderDeleted'), false);
  };

  const toggleFolderExpanded = (id: string) => {
    setExpandedFolderIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------------------------------------------------------------- */
  /* export                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Closes the export dialog and clears its state.
   *
   * The password is wiped too: it is a secret, and leaving it in state would
   * show it again the next time the dialog is opened.
   */
  const closeExportDialog = useCallback(() => {
    setDialog('none');
    setIsExporting(false);
    setIsPickingLocation(false);
    setExportError('');
    setPassword('');
    setWithoutPassword(false);
    setFileNameInput('');
  }, []);

  /** Closes the import dialog and wipes the password it asked for. */
  const closeImportDialog = useCallback(() => {
    setDialog('none');
    setImportPassword('');
    setImportError('');
    setIsImporting(false);
  }, []);

  /** Closes the new-folder dialog and clears the name that was typed. */
  const closeFolderDialog = useCallback(() => {
    setDialog('none');
    setFolderName('');
  }, []);

  const handleExport = async () => {
    if (!withoutPassword && password.length < MIN_PASSWORD_LENGTH) return;
    if (isPickingLocation || isExporting) return;

    const encrypted = !withoutPassword;
    const fileName = buildExportFileName(fileNameInput, encrypted);

    // The save picker must be opened from inside the user gesture, so it
    // cannot be deferred to the timeout below - that would lose the
    // activation and the browser would reject it.
    let handle: MemexFileHandle | null = null;
    const picker = getSaveFilePicker();
    if (picker) {
      setIsPickingLocation(true);
      try {
        handle = await picker({
          suggestedName: fileName,
          types: [
            {
              description: 'Memex vault',
              accept: { 'application/json': [extensionOf(encrypted)] },
            },
          ],
        });
      } catch (error) {
        // The user cancelled the dialog - that is not an error.
        if (isAbortError(error)) {
          setIsPickingLocation(false);
          return;
        }
        // Any other failure (a blocked permission, a browser that refuses)
        // falls back to a normal download rather than losing the export.
        console.error('Memex: the save picker failed, falling back to a download.', error);
        handle = null;
      } finally {
        setIsPickingLocation(false);
      }
    }

    setIsExporting(true);

    // The encryption runs synchronously, but yielding first lets the button
    // paint its "encrypting" state before the main thread is blocked by the
    // Argon2 derivation.
    window.setTimeout(() => {
      void (async () => {
        let text: string;
        try {
          const payload = { version: 2, folders, notes };
          const file = encrypted
            ? encryptMemexFile(payload, password)
            : createPlaintextMemexFile(payload);
          text = serialiseMemexFile(file);
        } catch (error) {
          // The encryption itself failed - there is no file to save yet.
          console.error('Memex: encryption failed.', error);
          if (isMounted.current) {
            setExportError(t('memexExportFailed'));
            showToast(t('memexExportFailed'), false);
            setIsExporting(false);
          }
          return;
        }

        if (handle) {
          try {
            // Bytes rather than a string: some implementations are pickier
            // about the type, and this is the content we want byte for byte.
            await writeExportToHandle(handle, text);
          } catch (error) {
            // The picker already created a file at the chosen location, but
            // the write failed - the file would be empty or truncated. It is
            // deleted before falling back to a download, because one export
            // must never leave two files behind (a broken one *and* the
            // download).
            console.error('Memex: writing to the chosen location failed, falling back to a download.', error);
            try {
              await handle.remove?.();
            } catch (cleanupError) {
              console.error('Memex: could not remove the empty export file.', cleanupError);
            }
            handle = null;
          }
        }

        if (!handle) {
          try {
            downloadTextFile(fileName, text, 'application/json');
          } catch (error) {
            console.error('Memex: the download failed.', error);
            if (isMounted.current) {
              setExportError(t('memexExportFailed'));
              showToast(t('memexExportFailed'), false);
              setIsExporting(false);
            }
            return;
          }
        }

        setPassword('');
        setWithoutPassword(false);
        setFileNameInput('');
        if (isMounted.current) {
          setExportError('');
          setDialog('none');
          setIsExporting(false);
        }
        showToast(t('memexExportDone'), false);
      })();
    }, 0);
  };

  /* ---------------------------------------------------------------- */
  /* import                                                            */
  /* ---------------------------------------------------------------- */

  const handleFileSelected = async (file: File) => {
    setImportError('');
    setImportPassword('');
    setImportMode('replace');

    try {
      const text = await file.text();
      const parsed = deserialiseMemexFile(text);

      if (parsed.encrypted) {
        // The password is asked for in the dialog; the file is parsed first
        // so the user knows it really is an encrypted Memex file.
        setImportPayload(null);
        setPendingEncryptedFile(parsed);
        openDialog('import');
        return;
      }

      const imported = sanitiseDocument(parsed);
      setImportPayload({
        notes: imported.notes,
        folders: imported.folders,
        encrypted: false,
      });
      openDialog('import');
    } catch (error) {
      console.error('Memex: the import file could not be read.', error);
      const message =
        error instanceof MemexFormatError
          ? t('memexImportInvalidFile')
          : t('memexImportFailed');
      setImportError(message);
      openDialog('import');
    }
  };

  const handleConfirmImport = () => {
    setIsImporting(true);
    setImportError('');

    window.setTimeout(() => {
      try {
        let importedNotes: MemexNote[];
        let importedFolders: MemexFolder[];

        if (pendingEncryptedFile) {
          const payload = decryptMemexFile(pendingEncryptedFile, importPassword);
          const decrypted = sanitiseDocument(payload);
          importedNotes = decrypted.notes;
          importedFolders = decrypted.folders;
        } else if (importPayload) {
          importedNotes = importPayload.notes;
          importedFolders = importPayload.folders;
        } else {
          importedNotes = [];
          importedFolders = [];
        }

        if (importMode === 'replace') {
          commit(importedFolders, importedNotes);
          showToast(
            t('memexImportDone', {
              added: importedNotes.length,
              folders: importedFolders.length,
            }),
            false
          );
        } else {
          const folderResult = mergeFolders(folders, importedFolders);
          const noteResult = mergeNotes(notes, importedNotes);
          commit(folderResult.folders, noteResult.notes);
          showToast(
            t('memexImportDoneWithSkips', {
              added: noteResult.added,
              skipped: noteResult.skipped,
              folders: folderResult.added,
            }),
            false
          );
        }

        setPendingEncryptedFile(null);
        setImportPayload(null);
        setImportPassword('');
        setDialog('none');
      } catch (error) {
        // Log the real cause - the user only ever sees a generic message,
        // and without this there is no way to tell a wrong password from a
        // damaged file or a failing key derivation.
        console.error('Memex: the import failed.', error);
        const message =
          error instanceof MemexDecryptError
            ? t('memexImportWrongPassword')
            : t('memexImportFailed');
        setImportError(message);
      } finally {
        setIsImporting(false);
      }
    }, 0);
  };

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  const passwordTooShort =
    !withoutPassword && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  const exportDisabled =
    isExporting ||
    isPickingLocation ||
    (!withoutPassword && (password.length < MIN_PASSWORD_LENGTH || !canEncrypt));

  const notesInActiveFolder = activeFolderId
    ? visibleNotes.filter((note) => note.folderId === activeFolderId)
    : visibleNotes;

  /** The name the exported file will get, shown as a hint in the dialog. */
  const resolvedExportName = buildExportFileName(fileNameInput, !withoutPassword);
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg">
            <NotebookPen className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('memexTitle')}
          </h1>
          <p className="mt-2 text-gray-600">{t('memexSubtitle')}</p>
        </div>

        {/* Privacy notice */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
          <p className="text-sm text-cyan-900">{t('memexPrivacyNote')}</p>
        </div>

        {/* The browser cannot encrypt, so say so up front. */}
        {isLoaded && !canEncrypt && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-900">{t('memexEncryptionUnavailable')}</p>
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleCreateNote(activeFolderId)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          >
            <Plus className="h-4 w-4" />
            {t('memexNewNote')}
          </button>

          <button
            type="button"
            onClick={() => {
              setFolderName('');
              openDialog('newFolder');
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 py-2.5 font-medium text-cyan-700 transition-colors hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          >
            <FolderPlus className="h-4 w-4" />
            {t('memexNewFolder')}
          </button>

          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('memexSearch')}
              aria-label={t('memexSearch')}
              {...SAFE_INPUT}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setFileNameInput('');
              setExportError('');
              openDialog('export');
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <Download className="h-4 w-4" />
            {t('memexExport')}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <FileUp className="h-4 w-4" />
            {t('memexImport')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".memex,.json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
              event.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => openDialog('deleteAll')}
            disabled={notes.length === 0 && folders.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <Trash2 className="h-4 w-4" />
            {t('memexDeleteAll')}
          </button>
        </div>

        {/* Content */}
        <div className="relative">
          {locked && (
            <button
              type="button"
              onClick={() => setLocked(false)}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            >
              <Lock className="h-8 w-8 text-gray-400" />
              <span className="font-medium text-gray-700">{t('memexLocked')}</span>
              <span className="text-sm text-gray-500">{t('memexUnlockHint')}</span>
            </button>
          )}

          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Folder tree */}
            <aside className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              {!isLoaded ? (
                <p className="px-2 py-6 text-center text-sm text-gray-500">
                  {t('loading')}
                </p>
              ) : (
                <>
                  {/* View switch: the folder tree, or one flat list. */}
                  <div
                    className="mb-2 flex items-center gap-1 rounded-lg bg-gray-100 p-1"
                    role="group"
                    aria-label={t('memexViewMode')}
                  >
                    <button
                      type="button"
                      onClick={() => setView('grouped')}
                      aria-pressed={view === 'grouped'}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500/50',
                        view === 'grouped'
                          ? 'bg-white text-cyan-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <Folder className="h-3.5 w-3.5" />
                      {t('memexViewGrouped')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('flat')}
                      aria-pressed={view === 'flat'}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500/50',
                        view === 'flat'
                          ? 'bg-white text-cyan-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <List className="h-3.5 w-3.5" />
                      {t('memexViewFlat')}
                    </button>
                  </div>

                  {view === 'flat' ? (
                    /* Flat view: every note in one list, with its folder. */
                    <ul className="space-y-0.5">
                      {sortNotes(searchedNotes).length === 0 ? (
                        <li className="px-2 py-6 text-center text-sm text-gray-500">
                          {query ? t('memexSearchNoResults') : t('memexEmptyTitle')}
                        </li>
                      ) : (
                        sortNotes(searchedNotes).map((note) => {
                          const folder = folders.find((f) => f.id === note.folderId);
                          return (
                            <li key={note.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedNoteId(note.id)}
                                className={cn(
                                  'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500/50',
                                  selectedNoteId === note.id
                                    ? 'bg-cyan-50 ring-1 ring-cyan-200'
                                    : 'hover:bg-gray-50'
                                )}
                              >
                                {note.pinned && (
                                  <Pin className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
                                )}
                                <span className="truncate text-sm text-gray-800">
                                  {note.title || t('memexNoteTitlePlaceholder')}
                                </span>
                                {folder && (
                                  <span className="ml-auto shrink-0 truncate text-xs text-gray-400">
                                    {folder.name}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  ) : (
                    <>
                      {/* Folders */}
                      {orderedFolders.length > 0 && (
                        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('memexFolders')}
                        </p>
                      )}
                      <ul className="space-y-0.5">
                        {orderedFolders.map((folder) => {
                          // A folder's notes only appear in the tree once the
                          // user expands it - opening a folder from the main
                          // pane does not reveal them in the tree.
                          const expanded = expandedFolderIds.has(folder.id);
                          const count = noteCounts.get(folder.id) ?? 0;
                          return (
                            <li key={folder.id}>
                              <div
                                className={cn(
                                  'flex items-center gap-1 rounded-lg pr-1 transition-colors',
                                  activeFolderId === folder.id
                                    ? 'bg-cyan-50 ring-1 ring-cyan-200'
                                    : 'hover:bg-gray-50'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleFolderExpanded(folder.id)}
                                  aria-label={folder.name}
                                  aria-expanded={expanded}
                                  className="flex h-8 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                                >
                                  {expanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Clicking the open folder again closes
                                    // it, which is the way back to the
                                    // unfiled notes.
                                    setActiveFolderId(
                                      activeFolderId === folder.id ? null : folder.id
                                    );
                                    setSelectedNoteId(null);
                                  }}
                                  aria-label={t('memexOpenFolder', { name: folder.name })}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                                >
                                  <Folder className="h-4 w-4 shrink-0 text-cyan-600" />
                                  <span className="truncate text-sm font-medium text-gray-800">
                                    {folder.name}
                                  </span>
                                  <span className="text-xs text-gray-400">{count}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFolderToDelete(folder);
                                    openDialog('deleteFolder');
                                  }}
                                  aria-label={`${t('memexDeleteFolder')}: ${folder.name}`}
                                  title={t('memexDeleteFolder')}
                                  className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {expanded && (
                                <ul className="ml-6 space-y-0.5 border-l border-gray-100 pl-2">
                                  {notesInFolder(searchedNotes, folder.id).length === 0 ? (
                                    <li className="px-2 py-1.5 text-xs text-gray-400">
                                      {t('memexEmptyFolder')}
                                    </li>
                                  ) : (
                                    notesInFolder(searchedNotes, folder.id).map((note) => (
                                      <NoteRow
                                        key={note.id}
                                        note={note}
                                        selected={selectedNoteId === note.id}
                                        onSelect={() => setSelectedNoteId(note.id)}
                                      />
                                    ))
                                  )}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {/* Unfiled */}
                      <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t('memexUnfiled')}
                      </p>
                      {unfiledNotes.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-gray-400">
                          {t('memexUnfiledEmpty')}
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {unfiledNotes.map((note) => (
                            <NoteRow
                              key={note.id}
                              note={note}
                              selected={selectedNoteId === note.id}
                              onSelect={() => setSelectedNoteId(note.id)}
                            />
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </aside>

            {/* Main pane */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              {selectedNote ? (
                <NoteEditor
                  key={selectedNote.id}
                  note={selectedNote}
                  folders={orderedFolders}
                  onChange={(patch) => handleUpdateNote(selectedNote.id, patch)}
                  onMove={(folderId) => handleMoveNote(selectedNote.id, folderId)}
                  onTogglePin={() => handleTogglePin(selectedNote.id)}
                  onDelete={() => handleDeleteNote(selectedNote.id)}
                />
              ) : isEmptyVault ? (
                /* First run: offer both a note and a folder. */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <NotebookPen className="mb-4 h-12 w-12 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('memexChooseHowToStart')}
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-gray-600">
                    {t('memexChooseHowToStartDesc')}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCreateNote(UNFILED)}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                    >
                      <Plus className="h-4 w-4" />
                      {t('memexNewNote')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFolderName('');
                        openDialog('newFolder');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 py-2.5 font-medium text-cyan-700 transition-colors hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                    >
                      <FolderPlus className="h-4 w-4" />
                      {t('memexNewFolder')}
                    </button>
                  </div>
                </div>
              ) : activeFolder ? (
                /* A folder is open: list its notes. */
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-cyan-600" />
                      <h2 className="text-xl font-bold text-gray-900">
                        {activeFolder.name}
                      </h2>
                      <span className="text-sm text-gray-500">
                        {notesInActiveFolder.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCreateNote(activeFolder.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                    >
                      <Plus className="h-4 w-4" />
                      {t('memexNewNoteInFolder')}
                    </button>
                  </div>

                  {notesInActiveFolder.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500">
                      {t('memexEmptyFolder')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {notesInActiveFolder.map((note) => (
                        <li key={note.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedNoteId(note.id)}
                            className="w-full rounded-lg px-2 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                          >
                            <span className="flex items-center gap-2">
                              {note.pinned && (
                                <Pin className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
                              )}
                              <span className="font-medium text-gray-900">
                                {note.title || t('memexNoteTitlePlaceholder')}
                              </span>
                            </span>
                            {note.body && (
                              <span className="mt-0.5 block truncate text-sm text-gray-500">
                                {note.body}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                /* Nothing selected: show the notes that are not in a folder. */
                <div>
                  <h2 className="mb-1 text-xl font-bold text-gray-900">
                    {view === 'flat' ? t('memexAllNotes') : t('memexUnfiled')}
                  </h2>
                  {view === 'grouped' && filedNoteCount > 0 && (
                    <p className="mb-4 text-sm text-gray-500">
                      {t('memexFiledHidden', { count: filedNoteCount })}
                    </p>
                  )}
                  {visibleNotes.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500">
                      {query
                        ? t('memexSearchNoResults')
                        : view === 'flat'
                          ? t('memexEmptyTitle')
                          : t('memexUnfiledEmpty')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {visibleNotes.map((note) => (
                        <li key={note.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedNoteId(note.id)}
                            className="w-full rounded-lg px-2 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                          >
                            <span className="flex items-center gap-2">
                              {note.pinned && (
                                <Pin className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
                              )}
                              <span className="font-medium text-gray-900">
                                {note.title || t('memexNoteTitlePlaceholder')}
                              </span>
                              {note.folderId && (
                                <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-xs text-cyan-700">
                                  {folders.find((f) => f.id === note.folderId)?.name}
                                </span>
                              )}
                            </span>
                            {note.body && (
                              <span className="mt-0.5 block truncate text-sm text-gray-500">
                                {note.body}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
            <span>{toast.message}</span>
            {toast.canUndo && (
              <button
                type="button"
                onClick={handleUndoDelete}
                className="font-semibold text-cyan-300 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              >
                {t('memexUndo')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Export dialog */}
      {dialog === 'export' && (
        <Modal title={t('memexExportTitle')} onClose={closeExportDialog}>
          <p className="mb-4 text-sm text-gray-600">{t('memexExportExplain')}</p>

          {exportError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          <label
            htmlFor="memex-filename"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t('memexFileName')}
          </label>
          <input
            id="memex-filename"
            type="text"
            value={fileNameInput}
            onChange={(event) => setFileNameInput(event.target.value)}
            placeholder={`memex-${fileNameStamp()}`}
            aria-label={t('memexFileName')}
            {...SAFE_INPUT}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            {t('memexFileNamePreview', { name: resolvedExportName })}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {canPickLocation
              ? t('memexChooseLocationHint')
              : t('memexDefaultLocationHint')}
          </p>

          <label
            htmlFor="memex-password"
            className="mb-1.5 mt-4 block text-sm font-medium text-gray-700"
          >
            {t('memexPassword')}
          </label>
          <input
            id="memex-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('memexPasswordPlaceholder')}
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          />
          {passwordTooShort && (
            <p className="mt-1.5 text-sm text-amber-600">
              {t('memexPasswordTooShort')}
            </p>
          )}
          {!withoutPassword && password.length === 0 && (
            <p className="mt-1.5 text-sm text-gray-500">
              {t('memexPasswordRequired')}
            </p>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={withoutPassword}
              onChange={(event) => setWithoutPassword(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span>
              {t('memexExportWithoutPassword')}
              <span className="mt-0.5 block text-xs text-amber-600">
                {t('memexExportWithoutPasswordWarning')}
              </span>
            </span>
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeExportDialog}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            >
              {isExporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isExporting
                ? t('memexExporting')
                : isPickingLocation
                  ? t('memexChoosingLocation')
                  : t('memexExport')}
            </button>
          </div>
        </Modal>
      )}

      {/* Import dialog */}
      {dialog === 'import' && (
        <Modal title={t('memexImportTitle')} onClose={closeImportDialog}>
          {importError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {pendingEncryptedFile && (
            <>
              <label
                htmlFor="memex-import-password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {t('memexPassword')}
              </label>
              <input
                id="memex-import-password"
                type="password"
                value={importPassword}
                onChange={(event) => setImportPassword(event.target.value)}
                placeholder={t('memexPasswordPlaceholder')}
                autoComplete="current-password"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
              />
            </>
          )}

          <p className="mt-4 mb-2 text-sm font-medium text-gray-700">
            {t('memexImportMode')}
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="memex-import-mode"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                className="h-4 w-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              {t('memexImportReplace')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="memex-import-mode"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
                className="h-4 w-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              {t('memexImportMerge')}
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeImportDialog}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-cyan-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            >
              {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isImporting ? t('memexImporting') : t('memexImport')}
            </button>
          </div>
        </Modal>
      )}

      {/* New folder dialog */}
      {dialog === 'newFolder' && (
        <Modal title={t('memexNewFolder')} onClose={closeFolderDialog}>
          <label
            htmlFor="memex-folder-name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t('memexFolderName')}
          </label>
          <input
            id="memex-folder-name"
            type="text"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateFolder();
            }}
            placeholder={t('memexFolderNamePlaceholder')}
            aria-label={t('memexFolderName')}
            {...SAFE_INPUT}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          />

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeFolderDialog}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={normaliseFolderName(folderName).length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            >
              <FolderPlus className="h-4 w-4" />
              {t('memexCreateFolder')}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete folder dialog */}
      {dialog === 'deleteFolder' && folderToDelete && (
        <Modal title={t('memexDeleteFolderTitle')} onClose={() => setDialog('none')}>
          <p className="text-sm text-gray-700">
            {t('memexDeleteFolderBody', {
              name: folderToDelete.name,
              count: noteCounts.get(folderToDelete.id) ?? 0,
            })}
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDialog('none')}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleDeleteFolder}
              className="rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              {t('memexDeleteFolderConfirm')}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete all dialog */}
      {dialog === 'deleteAll' && (
        <Modal title={t('memexDeleteAllTitle')} onClose={() => setDialog('none')}>
          <p className="text-sm text-gray-700">
            {t('memexDeleteAllBody', {
              notes: notes.length,
              folders: folders.length,
            })}
          </p>
          <p className="mt-2 text-sm text-amber-600">{t('memexDeleteAllBackup')}</p>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDialog('none')}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              className="rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              {t('memexDeleteAllConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * The editor for a single note. It is keyed by the note id, so switching
 * notes remounts it and the local draft state starts clean.
 */
function NoteEditor({
  note,
  folders,
  onChange,
  onMove,
  onTogglePin,
  onDelete,
}: {
  note: MemexNote;
  folders: MemexFolder[];
  onChange: (patch: Partial<MemexNote>) => void;
  onMove: (folderId: string | null) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags.join(', '));

  const update = (patch: Partial<MemexNote>) => {
    onChange(patch);
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <input
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            update({ title: event.target.value });
          }}
          placeholder={t('memexNoteTitlePlaceholder')}
          aria-label={t('memexNoteTitleLabel')}
          {...SAFE_INPUT}
          className="flex-1 border-b-2 border-transparent bg-transparent text-2xl font-bold text-gray-900 placeholder:text-gray-300 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
        />
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={note.pinned ? t('memexUnpin') : t('memexPin')}
          title={note.pinned ? t('memexUnpin') : t('memexPin')}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-cyan-600 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
        >
          {note.pinned ? (
            <PinOff className="h-5 w-5 text-cyan-600" />
          ) : (
            <Pin className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('memexDeleteNote')}
          title={t('memexDeleteNote')}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/50"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <textarea
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          update({ body: event.target.value });
        }}
        placeholder={t('memexNoteBodyPlaceholder')}
        aria-label={t('memexNoteBodyLabel')}
        {...SAFE_INPUT}
        className="min-h-[240px] w-full resize-y bg-transparent text-gray-800 placeholder:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
      />

      <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="memex-folder-select"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t('memexMoveToFolder')}
          </label>
          <select
            id="memex-folder-select"
            value={note.folderId ?? ''}
            onChange={(event) =>
              onMove(event.target.value === '' ? UNFILED : event.target.value)
            }
            aria-label={t('memexMoveToFolder')}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          >
            <option value="">{t('memexNoFolder')}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="memex-tags"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t('memexTagsLabel')}
          </label>
          <input
            id="memex-tags"
            type="text"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              update({ tags: parseTagInput(event.target.value) });
            }}
            placeholder={t('memexTagsPlaceholder')}
            {...SAFE_INPUT}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        {t('memexLastUpdated', {
          date: new Date(note.updatedAt).toLocaleString(),
        })}
      </p>
    </div>
  );
}


/**
 * Memex - a private, local notes vault.
 *
 * Notes and folders live in this browser only. Exporting produces a single
 * encrypted file (Argon2id + XChaCha20-Poly1305) that the user controls.
 */
export function Memex() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-6xl">🔒</div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              Something went wrong
            </h2>
            <p className="mb-6 text-gray-600">
              Memex hit an unexpected error. Your notes are still stored in
              this browser - reloading the page will show them again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-lg bg-cyan-600 px-6 py-3 font-medium text-white transition-colors hover:bg-cyan-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      }
    >
      <MemexContent />
    </ErrorBoundary>
  );
}

export default Memex;

/** Exported for the tests: the storage key the vault lives under. */
export { MEMEX_STORAGE_KEY };
