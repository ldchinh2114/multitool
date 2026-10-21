import type { DictionaryResponse } from './types';
import { readCache, writeCache } from './api-cache';

/**
 * Word lookups for the Translate tool.
 *
 * The previous dictionary endpoint (`api.dictionaryapi.dev`) is offline - it
 * answers HTTP 530 (Cloudflare: origin unreachable) - so every lookup used to
 * fail and silently fall back to the slower datamuse definitions. This module
 * talks to the live Free Dictionary instance, normalises its response into the
 * app's `DictionaryResponse` shape, and caches the result in localStorage so a
 * word that was already looked up is instant and costs no network at all.
 */

const DICTIONARY_URL = 'https://freedictionaryapi.com/api/v1/entries/en/';
const THESAURUS_URL = 'https://api.datamuse.com/words';

const CACHE_KEY = 'word-details';
/** Definitions do not change - cache them for a week. */
const ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** The envelope is only a container; every entry carries its own timestamp. */
const ENVELOPE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_CACHED_WORDS = 60;

/** Raw Free Dictionary response (only the fields the app uses). */
interface RawSense {
  definition?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
}

interface RawEntry {
  partOfSpeech?: string;
  pronunciations?: { type?: string; text?: string }[];
  senses?: RawSense[];
  synonyms?: string[];
  antonyms?: string[];
}

interface RawResponse {
  word?: string;
  entries?: RawEntry[];
}

/** A definition coming from datamuse, used when the dictionary has no entry. */
export interface FallbackMeaning {
  partOfSpeech: string;
  definitions: string[];
}

/** Everything the word panel shows for a single word. */
export interface WordDetailsData {
  entry: DictionaryResponse | null;
  synonyms: string[];
  antonyms: string[];
  fallbackMeanings: FallbackMeaning[];
}

/**
 * Datamuse part-of-speech tags mapped to readable names.
 */
const DATAMUSE_POS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'unknown',
};

/**
 * Group raw datamuse definitions ("partOfSpeech\tdefinition") by part of speech.
 */
function parseDatamuseDefinitions(defs: string[]): FallbackMeaning[] {
  const groups = new Map<string, string[]>();
  for (const raw of defs) {
    const [posTag, ...rest] = raw.split('\t');
    const definition = rest.join('\t').trim();
    if (!definition) continue;
    const partOfSpeech = DATAMUSE_POS[posTag] ?? posTag;
    const list = groups.get(partOfSpeech) ?? [];
    list.push(definition);
    groups.set(partOfSpeech, list);
  }
  return Array.from(groups.entries()).map(([partOfSpeech, definitions]) => ({
    partOfSpeech,
    definitions,
  }));
}

/**
 * Convert the Free Dictionary payload into the app's `DictionaryResponse`.
 * Returns null when the word has no usable entry.
 */
export function normalizeDictionaryResponse(data: unknown): DictionaryResponse | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as RawResponse;
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) return null;

  const phonetics: { text: string; audio?: string }[] = [];
  const meanings: DictionaryResponse['meanings'] = [];

  for (const entry of raw.entries) {
    for (const pronunciation of entry.pronunciations ?? []) {
      if (pronunciation.type !== 'ipa' || !pronunciation.text) continue;
      if (phonetics.some((item) => item.text === pronunciation.text)) continue;
      phonetics.push({ text: pronunciation.text });
    }

    const definitions = (entry.senses ?? [])
      .filter((sense) => typeof sense.definition === 'string' && sense.definition.trim().length > 0)
      .map((sense) => ({
        definition: sense.definition as string,
        example: sense.examples?.[0],
      }));

    if (definitions.length === 0) continue;
    meanings.push({ partOfSpeech: entry.partOfSpeech ?? '', definitions });
  }

  if (meanings.length === 0) return null;

  return {
    word: raw.word ?? '',
    phonetic: phonetics[0]?.text,
    phonetics,
    meanings,
  };
}

async function fetchDictionaryEntry(word: string, signal: AbortSignal): Promise<DictionaryResponse | null> {
  const response = await fetch(`${DICTIONARY_URL}${encodeURIComponent(word.toLowerCase())}`, { signal });
  if (!response.ok) return null;
  return normalizeDictionaryResponse(await response.json());
}

async function fetchRelatedWords(word: string, rel: 'rel_syn' | 'rel_ant', signal: AbortSignal): Promise<string[]> {
  const response = await fetch(`${THESAURUS_URL}?${rel}=${encodeURIComponent(word)}&max=12`, { signal });
  if (!response.ok) return [];
  const results: { word: string }[] = await response.json();
  return results.map((result) => result.word);
}

async function fetchFallbackDefinitions(word: string, signal: AbortSignal): Promise<FallbackMeaning[]> {
  const response = await fetch(`${THESAURUS_URL}?sp=${encodeURIComponent(word)}&md=dp&max=1`, { signal });
  if (!response.ok) return [];
  const results: { word: string; defs?: string[] }[] = await response.json();
  const match = results.find((result) => result.word.toLowerCase() === word.toLowerCase());
  return parseDatamuseDefinitions(match?.defs ?? []);
}

type CachedWord = { v: WordDetailsData; ts: number };

function readCacheRecord(): Record<string, CachedWord> {
  return readCache<Record<string, CachedWord>>(CACHE_KEY, ENVELOPE_TTL_MS) ?? {};
}

/** Returns the cached details for a word, or undefined when there is none. */
export function getCachedWordDetails(word: string): WordDetailsData | undefined {
  const hit = readCacheRecord()[word.toLowerCase()];
  if (!hit) return undefined;
  if (Date.now() - hit.ts > ENTRY_TTL_MS) return undefined;
  return hit.v;
}

/** Caches the details for a word, keeping the cache small. */
export function setCachedWordDetails(word: string, data: WordDetailsData): void {
  const record = { ...readCacheRecord() };
  record[word.toLowerCase()] = { v: data, ts: Date.now() };

  const keys = Object.keys(record);
  if (keys.length > MAX_CACHED_WORDS) {
    const oldest = keys
      .sort((a, b) => record[a].ts - record[b].ts)
      .slice(0, keys.length - MAX_CACHED_WORDS);
    for (const key of oldest) delete record[key];
  }

  writeCache(CACHE_KEY, record);
}

/**
 * Loads everything known about a word. Each section is reported as soon as it
 * resolves so the panel fills in progressively instead of waiting for the
 * slowest request.
 */
export async function loadWordDetails(
  word: string,
  signal: AbortSignal,
  onPartial?: (patch: Partial<WordDetailsData>) => void
): Promise<WordDetailsData> {
  const collected: WordDetailsData = { entry: null, synonyms: [], antonyms: [], fallbackMeanings: [] };

  const tasks: Promise<void>[] = [
    fetchDictionaryEntry(word, signal)
      .then((value) => {
        collected.entry = value;
        onPartial?.({ entry: value });
      })
      .catch(() => {}),
    fetchRelatedWords(word, 'rel_syn', signal)
      .then((value) => {
        collected.synonyms = value;
        onPartial?.({ synonyms: value });
      })
      .catch(() => {}),
    fetchRelatedWords(word, 'rel_ant', signal)
      .then((value) => {
        collected.antonyms = value;
        onPartial?.({ antonyms: value });
      })
      .catch(() => {}),
    fetchFallbackDefinitions(word, signal)
      .then((value) => {
        collected.fallbackMeanings = value;
        onPartial?.({ fallbackMeanings: value });
      })
      .catch(() => {}),
  ];

  await Promise.allSettled(tasks);
  return collected;
}
