'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Search,
  Volume2,
  AlertCircle,
  Loader2,
  BookMarked,
  Lightbulb,
  Languages,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguage } from '@/lib/language-context';
import { DictionaryResponse } from '@/lib/types';
import { debounce } from '@/lib/utils';

const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const SUGGESTIONS_URL = 'https://api.datamuse.com/sug';
const SYNONYMS_URL = 'https://api.datamuse.com/words';

/**
 * Translation Helper - Uses Google Translate's public endpoint
 */
async function translateToVietnamese(text: string): Promise<string> {
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!response.ok) throw new Error('Translation failed');
    const data = await response.json();
    return data[0].map((item: unknown) => (item as string[])[0]).join('');
  } catch (error) {
    console.error('Translation error:', error);
    return '';
  }
}

/**
 * Audio Player Component
 */
function AudioPlayer({ audioUrl }: { audioUrl?: string }) {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use ref to manage audio - no setState in effect
  useEffect(() => {
    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (audioUrl) {
      audioRef.current = new Audio(audioUrl);
    } else {
      audioRef.current = null;
    }
  }, [audioUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    const handleEnded = () => setIsPlaying(false);
    audioRef.current.addEventListener('ended', handleEnded);
    return () => audioRef.current?.removeEventListener('ended', handleEnded);
  }, []);

  const handlePlay = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  };

  if (!audioUrl) return null;

  return (
    <button
      onClick={handlePlay}
      disabled={isPlaying}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
        isPlaying
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
      )}
    >
      <Volume2 className={cn('h-4 w-4', isPlaying && 'animate-pulse')} />
      {isPlaying ? t('loading') : t('phonetics')}
    </button>
  );
}

/**
 * Definition Card - Updated with translation support
 */
function DefinitionCard({
  partOfSpeech,
  definitions,
}: {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}) {
  const { t, language } = useLanguage();
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
        const transDef = await translateToVietnamese(def.definition);
        const transEx = def.example ? await translateToVietnamese(def.example) : undefined;
        return { definition: transDef, example: transEx };
      })
    );
    setTranslatedData(translations);
    setIsTranslating(false);
    setShowTranslation(true);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-purple-500" />
          <span className="text-lg font-semibold italic text-gray-900 dark:text-gray-100">
            {partOfSpeech}
          </span>
        </div>
        
        {/* Translation Toggle Button */}
        {language === 'vi' && (
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-purple-600 shadow-sm transition-all hover:bg-purple-50 dark:bg-gray-700 dark:text-purple-400 dark:hover:bg-gray-600"
          >
            {isTranslating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Languages className="h-3 w-3" />
            )}
            {showTranslation ? t('originalEnglish') : t('translateToVi')}
          </button>
        )}
      </div>

      <ul className="space-y-6">
        {definitions.map((def, idx) => (
          <li key={idx} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-2.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-purple-500" />
              <div className="flex flex-col gap-2">
                <p className="text-xl font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                  {showTranslation && translatedData[idx] ? translatedData[idx].definition : def.definition}
                </p>
                {showTranslation && (
                  <p className="text-lg text-gray-500 dark:text-gray-400 italic">
                    {def.definition}
                  </p>
                )}
              </div>
            </div>
            {def.example && (
              <div className="ml-5 rounded-xl bg-white p-4 border border-purple-100/50 italic text-gray-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400">
                <div className="flex flex-col gap-2">
                  <div className="text-lg">
                    <Lightbulb className="mb-1 mr-2 inline h-5 w-5 text-yellow-500" />
                    &quot;{showTranslation && translatedData[idx]?.example ? translatedData[idx].example : def.example}&quot;
                  </div>
                  {showTranslation && (
                    <p className="text-base text-gray-500 dark:text-gray-500">
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
 * Dictionary Content Component
 */
function DictionaryContent() {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<DictionaryResponse | null>(null);
  const [viMeaning, setViMeaning] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  // Loading states - used in callbacks but not displayed in UI
  const [, setLoadingSuggestions] = useState(false);
  const [, setLoadingSynonyms] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    try {
      const response = await fetch(`${SUGGESTIONS_URL}?s=${encodeURIComponent(term.trim())}&max=8`, { signal: abortControllerRef.current.signal });
      if (!response.ok) throw new Error();
      const results: { word: string }[] = await response.json();
      setSuggestions(results.map((r) => r.word));
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const fetchSynonyms = useCallback(async (term: string) => {
    setLoadingSynonyms(true);
    try {
      const response = await fetch(`${SYNONYMS_URL}?rel_syn=${encodeURIComponent(term)}&max=10`);
      if (response.ok) {
        const results = await response.json();
        setSynonyms(results.map((r: { word: string }) => r.word));
      }
    } catch (err) { console.error(err); } finally { setLoadingSynonyms(false); }
  }, []);

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setViMeaning('');
    
    try {
      const response = await fetch(`${API_URL}${term.trim().toLowerCase()}`);
      if (!response.ok) throw new Error(`No definitions found for "${term}"`);
      const results: DictionaryResponse[] = await response.json();
      setData(results[0]);
      setSearched(true);
      
      // Auto-translate the word itself for Vietnamese users
      if (language === 'vi') {
        const translation = await translateToVietnamese(term.trim());
        setViMeaning(translation);
      }
      
      fetchSynonyms(term.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [language, fetchSynonyms]);

  const debouncedFetchSuggestions = useMemo(() => debounce((term: string) => fetchSuggestions(term), 100), [fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(true);
    debouncedFetchSuggestions(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      performSearch(searchTerm);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
  };

  const audioUrl = data?.phonetics?.find((p) => p.audio)?.audio;

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-950">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t('dictionaryTitle')}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t('dictionarySubtitle')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-2xl mx-auto relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t('searchWord')}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white py-4 pl-12 pr-4 text-lg shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 animate-spin text-purple-500" />
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-purple-50 dark:hover:bg-gray-800 dark:text-gray-300"
                >
                  <Search className="h-4 w-4 text-gray-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {data && !loading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column: Word Info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm dark:border-gray-800 dark:bg-gray-900 text-center">
                <h2 className="text-6xl font-black capitalize tracking-tight text-gray-900 dark:text-gray-100">
                  {data.word}
                </h2>
                
                {/* Vietnamese Meaning (Bilingual feature) */}
                {viMeaning && (
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <ArrowRight className="h-6 w-6 text-purple-500" />
                    <span className="text-4xl font-extrabold text-purple-600 dark:text-purple-400">
                      {viMeaning}
                    </span>
                  </div>
                )}
                
                {data.phonetic && (
                  <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
                    {data.phonetic}
                  </p>
                )}
                
                <div className="mt-6">
                  <AudioPlayer audioUrl={audioUrl} />
                </div>
              </div>

              {/* Synonyms */}
              {synonyms.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('definitions')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {synonyms.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestionClick(s)}
                        className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Meanings */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('definitions')}
              </h3>
              {data.meanings.map((meaning, idx) => (
                <DefinitionCard
                  key={idx}
                  partOfSpeech={meaning.partOfSpeech}
                  definitions={meaning.definitions}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty/Error States */}
        {!searched && !loading && (
          <div className="mt-20 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <BookOpen className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">
              {t('enterWord')}
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t('dictionarySubtitle')}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-20 text-center max-w-md mx-auto rounded-2xl border border-red-100 bg-red-50 p-8 dark:border-red-900/30 dark:bg-red-900/10">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="mt-4 text-lg font-bold text-red-900 dark:text-red-100">
              {t('error')}
            </h3>
            <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Dictionary() {
  return (
    <ErrorBoundary>
      <DictionaryContent />
    </ErrorBoundary>
  );
}

export default Dictionary;
