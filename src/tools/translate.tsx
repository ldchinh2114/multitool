'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Languages,
  Search,
  Volume2,
  AlertCircle,
  Loader2,
  BookOpen,
  BookMarked,
  Lightbulb,
  ArrowLeftRight,
  Copy,
  Check,
  X,
  Settings,
  Sparkles,
  Ban,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguage } from '@/lib/language-context';
import { DictionaryResponse } from '@/lib/types';
import { debounce } from '@/lib/utils';

const DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const SUGGESTIONS_URL = 'https://api.datamuse.com/sug';
const THESAURUS_URL = 'https://api.datamuse.com/words';

// Only single English words have extra dictionary information available.
const SINGLE_WORD_REGEX = /^[a-zA-Z][a-zA-Z'’-]*$/;

interface AlternativeTranslation {
  partOfSpeech: string;
  terms: string[];
}

interface TranslationResult {
  text: string;
  alternatives: AlternativeTranslation[];
}

/**
 * Translate helper. Pulls the plain translation plus, when available, the
 * alternative translations grouped by part of speech (`dt=bd`).
 */
function parseTranslation(data: unknown): TranslationResult {
  const result: TranslationResult = { text: '', alternatives: [] };
  if (!Array.isArray(data)) return result;

  const sentences = data[0];
  if (Array.isArray(sentences)) {
    result.text = sentences
      .map((item) => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
      .join('');
  }

  const dictionary = data[1];
  if (Array.isArray(dictionary)) {
    for (const entry of dictionary) {
      if (!Array.isArray(entry)) continue;
      const partOfSpeech = typeof entry[0] === 'string' ? entry[0] : '';
      const terms = Array.isArray(entry[1])
        ? entry[1].filter((term): term is string => typeof term === 'string')
        : [];
      if (terms.length > 0) result.alternatives.push({ partOfSpeech, terms });
    }
  }

  return result;
}

async function translate(text: string, sl: string = 'en', tl: string = 'vi'): Promise<TranslationResult> {
  if (!text.trim()) return { text: '', alternatives: [] };
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&q=${encodeURIComponent(text)}`
    );
    if (!response.ok) throw new Error('Translation failed');
    const data: unknown = await response.json();
    return parseTranslation(data);
  } catch {
    return { text: '', alternatives: [] };
  }
}

/**
 * Audio Player Component - Uses API audio files with enhanced volume
 * Falls back to Web Speech API when audio files unavailable
 */
function AudioPlayer({ word, phonetics }: { word?: string; phonetics?: DictionaryResponse['phonetics'] }) {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(2.0);
  const [showSettings, setShowSettings] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // TTS fallback state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState(0.9);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Derive audio sources from phonetics data (pure computation)
  const audioSources = useMemo(() => {
    if (!phonetics || phonetics.length === 0) return [];

    const sources: { url: string; accent: string; title: string }[] = [];
    phonetics.forEach((phonetic) => {
      if (phonetic.audio) {
        let accent = 'US';
        let title = '🇺🇸 US';
        if (phonetic.audio.includes('gb') || phonetic.audio.includes('uk')) {
          accent = 'UK';
          title = '🇬🇧 UK';
        } else if (phonetic.audio.includes('us')) {
          accent = 'US';
          title = '🇺🇸 US';
        }
        if (!sources.find(s => s.url === phonetic.audio)) {
          sources.push({ url: phonetic.audio, accent, title });
        }
      }
    });
    return sources;
  }, [phonetics]);

  // User preference overrides
  const [preferTTS, setPreferTTS] = useState(false);
  const [userSelectedUrl, setUserSelectedUrl] = useState('');

  // Derived values
  const hasAudio = audioSources.length > 0;
  const useTTS = !hasAudio || preferTTS;
  const selectedSource = hasAudio ? (userSelectedUrl || audioSources[0].url) : '';

  // Track selectedVoice with a ref to avoid stale closure in voice loading
  const selectedVoiceRef = useRef(selectedVoice);

  // Sync ref with state value
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);

  // Load voices for TTS fallback
  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = synthRef.current?.getVoices() || [];
      setVoices(availableVoices);
      const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
      if (englishVoices.length > 0 && !selectedVoiceRef.current) {
        const preferred = englishVoices.find(v => v.name.includes('Google') || v.name.includes('Samantha')) || englishVoices[0];
        setSelectedVoice(preferred.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Play audio with boosted volume
  const playAudioWithBoost = async (url: string) => {
    try {
      setIsPlaying(true);

      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Fetch audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create source and gain nodes
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create gain node for volume boost
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volumeBoost;

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Handle playback events
      source.onended = () => {
        setIsPlaying(false);
      };

      // Play audio
      source.start(0);
    } catch {
      setIsPlaying(false);
      // Fallback to TTS if audio playback fails
      playWithTTS();
    }
  };

  // TTS fallback
  const playWithTTS = () => {
    if (!word || !synthRef.current) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(word);

    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;

    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    synthRef.current.speak(utterance);
  };

  const handlePlay = () => {
    if (!word) return;

    if (isPlaying) {
      stopPlay();
      return;
    }

    if (!useTTS && selectedSource) {
      playAudioWithBoost(selectedSource);
    } else {
      playWithTTS();
    }
  };

  const stopPlay = () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    synthRef.current?.cancel();
    setIsPlaying(false);
  };

  if (!word) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={handlePlay}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
          isPlaying
            ? 'bg-purple-600 text-white shadow-lg scale-105'
            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-md hover:shadow-lg'
        )}
      >
        <Volume2 className={cn('h-4 w-4', isPlaying && 'animate-pulse')} />
        {isPlaying ? t('loading') : t('phonetics')}
      </button>

      {/* Audio source selector */}
      {audioSources.length > 1 && (
        <select
          value={selectedSource}
          onChange={(e) => {
            setUserSelectedUrl(e.target.value);
            setPreferTTS(false);
          }}
          className="rounded-full border border-purple-200 bg-white px-3 py-2 text-xs font-medium text-purple-700 shadow-sm transition-colors hover:bg-purple-50"
        >
          {audioSources.map((source, idx) => (
            <option key={idx} value={source.url}>{source.title}</option>
          ))}
        </select>
      )}

      {/* TTS toggle when audio files exist */}
      {audioSources.length > 0 && (
        <button
          onClick={() => setPreferTTS(!preferTTS)}
          className={cn(
            'rounded-full px-3 py-2 text-xs font-medium transition-colors',
            useTTS
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
          title="Toggle Text-to-Speech"
        >
          🎙️ TTS
        </button>
      )}

      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
        title="Audio settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {showSettings && (
        <div className="w-full mt-2 p-4 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="space-y-4">
            {/* Volume Boost */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                🔊 Volume Boost: {Math.round(volumeBoost * 100)}%
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={volumeBoost}
                onChange={(e) => setVolumeBoost(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>100%</span>
                <span>200%</span>
                <span>300%</span>
              </div>
            </div>

            {/* TTS Settings (only if using TTS) */}
            {useTTS && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">Voice</label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                  >
                    {voices.filter(v => v.lang.startsWith('en')).map(v => (
                      <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">Speed: {rate.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Definition Card - one part of speech with all its definitions and examples.
 * Definitions can be translated to Vietnamese on demand.
 */
function DefinitionCard({
  partOfSpeech,
  definitions,
  targetLang,
}: {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
  targetLang: string;
}) {
  const { t } = useLanguage();
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedData, setTranslatedData] = useState<{ definition: string; example: string | undefined }[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    if (translatedData.length > 0) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    const translations = await Promise.all(
      definitions.map(async (def) => {
        const transDef = await translate(def.definition, 'en', targetLang);
        const transEx = def.example ? await translate(def.example, 'en', targetLang) : undefined;
        return { definition: transDef.text, example: transEx?.text };
      })
    );
    setTranslatedData(translations);
    setIsTranslating(false);
    setShowTranslation(true);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-purple-500" />
          <span className="text-lg font-semibold italic text-gray-900">
            {partOfSpeech}
          </span>
        </div>

        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-purple-600 shadow-sm transition-all hover:bg-purple-50"
        >
          {isTranslating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" />
          )}
          {showTranslation ? t('originalEnglish') : t('translateToVi')}
        </button>
      </div>

      <ul className="space-y-6">
        {definitions.map((def, idx) => (
          <li key={idx} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-2.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-purple-500" />
              <div className="flex flex-col gap-2">
                <p className="text-xl font-medium text-gray-800 leading-relaxed">
                  {showTranslation && translatedData[idx] ? translatedData[idx].definition : def.definition}
                </p>
                {showTranslation && (
                  <p className="text-lg text-gray-500 italic">
                    {def.definition}
                  </p>
                )}
              </div>
            </div>
            {def.example && (
              <div className="ml-5 rounded-xl bg-white p-4 border border-purple-100/50 italic text-gray-600">
                <div className="flex flex-col gap-2">
                  <div className="text-lg">
                    <Lightbulb className="mb-1 mr-2 inline h-5 w-5 text-yellow-500" />
                    &quot;{showTranslation && translatedData[idx]?.example ? translatedData[idx].example : def.example}&quot;
                  </div>
                  {showTranslation && translatedData[idx]?.example && (
                    <p className="text-base text-gray-500">
                      &quot;{def.example}&quot;
                    </p>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Related words - synonyms or antonyms chips.
 */
function RelatedWords({
  title,
  words,
  icon,
  onSelect,
}: {
  title: string;
  words: string[];
  icon: React.ReactNode;
  onSelect: (word: string) => void;
}) {
  if (words.length === 0) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
        {icon}
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {words.map((word) => (
          <button
            key={word}
            onClick={() => onSelect(word)}
            className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Datamuse part-of-speech tags mapped to readable names, used for the
 * definitions fallback when the primary dictionary API has no entry.
 */
const DATAMUSE_POS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'unknown',
};

interface FallbackMeaning {
  partOfSpeech: string;
  definitions: string[];
}

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
  return Array.from(groups, ([partOfSpeech, definitions]) => ({ partOfSpeech, definitions }));
}

/**
 * Session cache so revisiting a word (or jumping to a synonym) renders
 * instantly instead of refetching everything.
 */
interface WordDetailsData {
  entry: DictionaryResponse | null;
  synonyms: string[];
  antonyms: string[];
  fallbackMeanings: FallbackMeaning[];
}

const wordDetailsCache = new Map<string, WordDetailsData>();

async function fetchDictionaryEntry(word: string, signal: AbortSignal): Promise<DictionaryResponse | null> {
  const response = await fetch(`${DICTIONARY_URL}${encodeURIComponent(word.toLowerCase())}`, { signal });
  if (!response.ok) return null;
  const entries: DictionaryResponse[] = await response.json();
  return entries[0] ?? null;
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

/**
 * Word Details - everything we can find about a single word:
 * phonetics, audio, parts of speech, definitions, examples, synonyms,
 * antonyms and alternative translations.
 */
function WordDetails({
  word,
  alternatives,
  targetLang,
  onSelectWord,
}: {
  word: string;
  alternatives: AlternativeTranslation[];
  targetLang: string;
  onSelectWord: (word: string) => void;
}) {
  const { t } = useLanguage();
  const cacheKey = word.toLowerCase();
  // Seed from the session cache so previously looked-up words appear instantly.
  const cached = wordDetailsCache.get(cacheKey);
  const [entry, setEntry] = useState<DictionaryResponse | null>(cached?.entry ?? null);
  const [synonyms, setSynonyms] = useState<string[]>(cached?.synonyms ?? []);
  const [antonyms, setAntonyms] = useState<string[]>(cached?.antonyms ?? []);
  const [fallbackMeanings, setFallbackMeanings] = useState<FallbackMeaning[]>(cached?.fallbackMeanings ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (wordDetailsCache.has(cacheKey)) return;

    let cancelled = false;
    const controller = new AbortController();
    const collected: WordDetailsData = { entry: null, synonyms: [], antonyms: [], fallbackMeanings: [] };

    // Update each section as soon as its request resolves instead of waiting
    // for the slowest API, so the panel fills in progressively.
    const tasks: Promise<void>[] = [
      fetchDictionaryEntry(word, controller.signal)
        .then((value) => { collected.entry = value; if (!cancelled) setEntry(value); })
        .catch(() => {}),
      fetchRelatedWords(word, 'rel_syn', controller.signal)
        .then((value) => { collected.synonyms = value; if (!cancelled) setSynonyms(value); })
        .catch(() => {}),
      fetchRelatedWords(word, 'rel_ant', controller.signal)
        .then((value) => { collected.antonyms = value; if (!cancelled) setAntonyms(value); })
        .catch(() => {}),
      fetchFallbackDefinitions(word, controller.signal)
        .then((value) => { collected.fallbackMeanings = value; if (!cancelled) setFallbackMeanings(value); })
        .catch(() => {}),
    ];

    Promise.allSettled(tasks).then(() => {
      if (cancelled) return;
      wordDetailsCache.set(cacheKey, collected);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [word, cacheKey]);

  // Prefer the rich dictionary API data; fall back to datamuse definitions.
  const meanings =
    entry && entry.meanings.length > 0
      ? entry.meanings
      : fallbackMeanings.map((meaning) => ({
          partOfSpeech: meaning.partOfSpeech,
          definitions: meaning.definitions.map((definition) => ({ definition })),
        }));

  const hasAnything =
    Boolean(entry) ||
    synonyms.length > 0 ||
    antonyms.length > 0 ||
    meanings.length > 0 ||
    alternatives.length > 0;

  if (loading && !hasAnything) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-10 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span>{t('searchingDetails')}</span>
      </div>
    );
  }

  if (!hasAnything) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <Info className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-3 text-gray-600">{t('noWordInfo')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
          {t('searchingDetails')}
        </div>
      )}
      {/* Word header: spelling, phonetic and audio */}
      {entry && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-5xl font-black capitalize tracking-tight text-gray-900">
            {entry.word}
          </h2>
          {entry.phonetic && (
            <p className="mt-2 text-lg text-gray-500">{entry.phonetic}</p>
          )}
          <div className="mt-6">
            <AudioPlayer key={entry.word} word={entry.word} phonetics={entry.phonetics} />
          </div>
        </div>
      )}

      {/* Alternative translations from the translator, grouped by part of speech */}
      {alternatives.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Languages className="h-4 w-4 text-purple-500" />
            {t('otherTranslations')}
          </h3>
          <div className="space-y-3">
            {alternatives.map((alt, idx) => (
              <div key={idx} className="flex flex-wrap items-baseline gap-2">
                {alt.partOfSpeech && (
                  <span className="text-xs font-semibold italic text-gray-500">
                    {alt.partOfSpeech}
                  </span>
                )}
                {alt.terms.map((term) => (
                  <span
                    key={term}
                    className="rounded-lg bg-purple-50 px-2.5 py-1 text-sm text-purple-700"
                  >
                    {term}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synonyms and antonyms */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RelatedWords
          title={t('synonyms')}
          words={synonyms}
          icon={<Sparkles className="h-4 w-4 text-green-500" />}
          onSelect={onSelectWord}
        />
        <RelatedWords
          title={t('antonyms')}
          words={antonyms}
          icon={<Ban className="h-4 w-4 text-red-500" />}
          onSelect={onSelectWord}
        />
      </div>

      {/* Definitions and examples */}
      {meanings.length > 0 && (
        <div className="space-y-6">
          <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <BookOpen className="h-5 w-5 text-purple-500" />
            {t('definitions')}
          </h3>
          {meanings.map((meaning, idx) => (
            <DefinitionCard
              key={idx}
              partOfSpeech={meaning.partOfSpeech}
              definitions={meaning.definitions}
              targetLang={targetLang}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main Translate Component
 * Translate text between languages and reveal every detail of any word typed.
 */
export function Translate() {
  const { t } = useLanguage();
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [alternatives, setAlternatives] = useState<AlternativeTranslation[]>([]);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('vi');
  const [isTranslating, setIsTranslating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailWord, setDetailWord] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleTranslate = useCallback(async (text: string, sl: string, tl: string) => {
    if (!text.trim()) {
      setTargetText('');
      setAlternatives([]);
      setFailed(false);
      return;
    }
    setIsTranslating(true);
    setFailed(false);
    const result = await translate(text, sl, tl);
    setTargetText(result.text);
    setAlternatives(result.alternatives);
    setFailed(!result.text);
    setIsTranslating(false);
  }, []);

  const debouncedTranslate = useMemo(
    () => debounce((text: string, sl: string, tl: string) => handleTranslate(text, sl, tl), 500),
    [handleTranslate]
  );

  useEffect(() => {
    debouncedTranslate(sourceText, sourceLang, targetLang);
  }, [sourceText, sourceLang, targetLang, debouncedTranslate]);

  const fetchSuggestions = useCallback(async (term: string) => {
    try {
      const response = await fetch(`${SUGGESTIONS_URL}?s=${encodeURIComponent(term)}&max=8`);
      if (!response.ok) throw new Error('Suggestion request failed');
      const results: { word: string }[] = await response.json();
      setSuggestions(results.map((r) => r.word));
    } catch {
      setSuggestions([]);
    }
  }, []);

  const debouncedFetchSuggestions = useMemo(
    () => debounce((term: string) => fetchSuggestions(term), 150),
    [fetchSuggestions]
  );

  const debouncedSetDetailWord = useMemo(
    () => debounce((word: string) => setDetailWord(word), 250),
    []
  );

  // Only a single English word can have rich dictionary details.
  useEffect(() => {
    const trimmed = sourceText.trim();
    if (sourceLang === 'en' && SINGLE_WORD_REGEX.test(trimmed)) {
      debouncedSetDetailWord(trimmed);
    } else {
      setDetailWord('');
    }
  }, [sourceText, sourceLang, debouncedSetDetailWord]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSourceText(value);
    const trimmed = value.trim();
    if (sourceLang === 'en' && SINGLE_WORD_REGEX.test(trimmed)) {
      setShowSuggestions(true);
      debouncedFetchSuggestions(trimmed);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const selectWord = (word: string) => {
    setSourceText(word);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText(sourceText);
    setAlternatives([]);
    setFailed(false);
  };

  const clearText = () => {
    setSourceText('');
    setTargetText('');
    setAlternatives([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setFailed(false);
  };

  const copyToClipboard = () => {
    void navigator.clipboard?.writeText(targetText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trimmed = sourceText.trim();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto max-w-5xl px-4">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
              <Languages className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {t('translateTitle')}
            </h1>
            <p className="mt-2 text-gray-600">
              {t('translateSubtitle')}
            </p>
          </div>

          {/* Language selector */}
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
            <div className="flex flex-1 items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <span className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{t('sourceLanguage')}</span>
                <span className="font-bold text-gray-900">{sourceLang === 'en' ? t('english') : t('vietnamese')}</span>
              </div>

              <button
                onClick={swapLanguages}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all hover:bg-purple-100 hover:text-purple-600"
                title={t('swapLanguages')}
              >
                <ArrowLeftRight className="h-5 w-5" />
              </button>

              <div className="flex flex-col items-center">
                <span className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{t('targetLanguage')}</span>
                <span className="font-bold text-gray-900">{targetLang === 'en' ? t('english') : t('vietnamese')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Source text area */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-gray-400" />
              <textarea
                value={sourceText}
                onChange={handleSourceChange}
                onBlur={() => setShowSuggestions(false)}
                placeholder={t('enterTextToTranslate')}
                className="h-60 w-full resize-none rounded-2xl border-2 border-gray-200 bg-white p-6 pl-12 text-xl shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                autoFocus
              />
              {sourceText && (
                <button
                  onClick={clearText}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                  title={t('clearText')}
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectWord(suggestion)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm transition-colors hover:border-purple-300 hover:text-purple-600"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Target text area */}
            <div className="relative">
              <div className={cn(
                'h-60 w-full overflow-y-auto rounded-2xl border-2 border-transparent bg-purple-50 p-6 text-xl shadow-inner transition-all',
                isTranslating && 'opacity-50'
              )}>
                {targetText ? (
                  <p className="whitespace-pre-wrap">{targetText}</p>
                ) : (
                  <p className="italic text-gray-400">{isTranslating ? t('translating') : t('result')}</p>
                )}
              </div>

              <div className="absolute bottom-4 right-4 flex gap-2">
                {targetText && (
                  <button
                    onClick={copyToClipboard}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
                    title={t('copyTranslation')}
                  >
                    {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                  </button>
                )}
              </div>

              {isTranslating && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              )}
            </div>
          </div>

          {/* Word details - everything available for a single word */}
          {detailWord && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <h2 className="text-xl font-bold text-gray-900">
                  {t('wordDetails')}
                </h2>
              </div>
              <WordDetails
                key={detailWord}
                word={detailWord}
                alternatives={alternatives}
                targetLang={targetLang}
                onSelectWord={selectWord}
              />
            </div>
          )}

          {/* Empty state */}
          {!trimmed && (
            <div className="mt-16 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                <BookOpen className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium text-gray-900">
                {t('enterTextToTranslate')}
              </h3>
              <p className="mt-2 text-gray-600">
                {t('translateSubtitle')}
              </p>
            </div>
          )}

          {/* Error state */}
          {failed && !isTranslating && (
            <div className="mx-auto mt-12 max-w-md rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="mt-4 text-lg font-bold text-red-900">
                {t('error')}
              </h3>
              <p className="mt-2 text-red-600">{t('translationError')}</p>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default Translate;
