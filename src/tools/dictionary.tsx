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
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DictionaryResponse } from '@/lib/types';
import { debounce } from '@/lib/utils';

const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const SUGGESTIONS_URL = 'https://api.datamuse.com/sug';
const SYNONYMS_URL = 'https://api.datamuse.com/words';
// Datamuse definitions endpoint - Free, no key required, supports phrases
const DATAMUSE_DEFINITIONS_URL = 'https://api.datamuse.com/words';
// Wordnik API - requires API key for full access
const WORDNIK_BASE_URL = 'https://api.wordnik.com/v4';

/**
 * Audio Player Component - Phát âm thanh từ dictionary
 */
function AudioPlayer({ audioUrl }: { audioUrl?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(audioUrl ? new Audio(audioUrl) : null);

  useEffect(() => {
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  const handlePlay = async () => {
    if (!audio) return;
    try {
      await audio.play();
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
      {isPlaying ? 'Playing...' : 'Play Pronunciation'}
    </button>
  );
}

/**
 * Definition Card - Hiển thị nghĩa của từ theo part of speech
 */
function DefinitionCard({
  partOfSpeech,
  definitions,
}: {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <BookMarked className="h-5 w-5 text-purple-500" />
        <span className="text-lg font-semibold italic text-gray-900 dark:text-gray-100">
          {partOfSpeech}
        </span>
      </div>
      <ul className="space-y-4">
        {definitions.map((def, idx) => (
          <li key={idx} className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />
              <p className="text-gray-700 dark:text-gray-300">{def.definition}</p>
            </div>
            {def.example && (
              <div className="ml-5 rounded-lg bg-white p-3 italic text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                <Lightbulb className="mb-1 inline h-4 w-4 text-yellow-500" />
                &quot;{def.example}&quot;
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Dictionary Content - Component chính
 */
function DictionaryContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<DictionaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [phrasalVerbs, setPhrasalVerbs] = useState<string[]>([]);
  const [loadingSynonyms, setLoadingSynonyms] = useState(false);
  const [loadingPhrasalVerbs, setLoadingPhrasalVerbs] = useState(false);
  const [noSuggestions, setNoSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [checkingWord, setCheckingWord] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const checkAbortRef = useRef<AbortController | null>(null);

  // Fetch suggestions from Datamuse API - no filtering, instant results
  const fetchSuggestions = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSuggestions([]);
      setNoSuggestions(false);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    setNoSuggestions(false);
    
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${SUGGESTIONS_URL}?s=${encodeURIComponent(term.trim())}&max=8`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) {
        console.warn(`Suggestions API returned ${response.status} for "${term}"`);
        setSuggestions([]);
        setNoSuggestions(false); // Don't show error for API failures
        setLoadingSuggestions(false);
        return;
      }
      
      const results: { word: string }[] = await response.json();
      
      // No filtering - show all suggestions from API
      const validSuggestions = results.map((r) => r.word).slice(0, 8);
      
      if (validSuggestions.length === 0) {
        setSuggestions([]);
        setNoSuggestions(false); // Don't show "no suggestions" for empty results
      } else {
        setSuggestions(validSuggestions);
        setNoSuggestions(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }
      console.error('Failed to fetch suggestions:', err);
      setSuggestions([]);
      setNoSuggestions(false); // Don't show error for network failures
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Fetch synonyms from Datamuse API - for single words only
  const fetchSynonyms = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSynonyms([]);
      return;
    }

    setLoadingSynonyms(true);
    try {
      const normalizedTerm = term.trim().toLowerCase();
      
      // Only fetch synonyms for single words (not phrasal verbs)
      const response = await fetch(`${SYNONYMS_URL}?rel_syn=${encodeURIComponent(normalizedTerm)}&max=15`);
      if (!response.ok) {
        setSynonyms([]);
        setLoadingSynonyms(false);
        return;
      }
      const results = await response.json();
      
      // No filtering - show all synonyms
      const validSynonyms = results.map((r) => r.word).slice(0, 15);
      
      setSynonyms(validSynonyms);
    } catch (err) {
      console.error('Failed to fetch synonyms:', err);
      setSynonyms([]);
    } finally {
      setLoadingSynonyms(false);
    }
  }, []);

  // Fetch phrasal verbs from Datamuse API - for single words only
  const fetchPhrasalVerbs = useCallback(async (term: string) => {
    if (!term.trim()) {
      setPhrasalVerbs([]);
      return;
    }

    setLoadingPhrasalVerbs(true);
    try {
      const normalizedTerm = term.trim().toLowerCase();
      
      // Common phrasal verb particles
      const particles = ['up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'through', 'around', 'away', 'back', 'forth', 'into', 'upon', 'with', 'by', 'at', 'from'];
      
      // Construct common phrasal verb patterns and check which ones exist
      const phrasalVerbPatterns = particles.map(particle => `${normalizedTerm} ${particle}`);
      
      // Also try reverse patterns (particle + verb) for some cases
      const reverseParticles = ['up', 'down', 'in', 'out', 'on', 'off', 'over', 'under'];
      const reversePatterns = reverseParticles.map(particle => `${particle} ${normalizedTerm}`);
      
      // Combine all patterns
      const allPatterns = [...phrasalVerbPatterns, ...reversePatterns];
      
      // Check which phrasal verbs exist using Datamuse suggestions API
      const validPhrasalVerbs: string[] = [];
      
      // Check in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < allPatterns.length; i += batchSize) {
        const batch = allPatterns.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (pattern) => {
            try {
              const response = await fetch(`${SUGGESTIONS_URL}?s=${encodeURIComponent(pattern)}&max=3`);
              if (!response.ok) return null;
              const data: { word: string }[] = await response.json();
              // Check if any suggestion matches our pattern exactly or starts with it
              const match = data.find(item => item.word.toLowerCase() === pattern || item.word.toLowerCase().startsWith(pattern + ' '));
              return match ? match.word : null;
            } catch {
              return null;
            }
          })
        );
        
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            if (!validPhrasalVerbs.includes(result.value)) {
              validPhrasalVerbs.push(result.value);
            }
          }
        });
        
        // Stop early if we already have enough
        if (validPhrasalVerbs.length >= 15) break;
      }
      
      // If no phrasal verbs found via pattern matching, try searching for related phrases
      if (validPhrasalVerbs.length === 0) {
        try {
          const phraseResponse = await fetch(`${SYNONYMS_URL}?rel_trg=${encodeURIComponent(normalizedTerm)}&max=30`);
          if (phraseResponse.ok) {
            const phraseResults: { word: string }[] = await phraseResponse.json();
            const phrasePhrasalVerbs = phraseResults
              .map((r) => r.word)
              .filter((word) => {
                const words = word.split(' ');
                return words.length >= 2 && words.some((w) => particles.includes(w.toLowerCase()));
              })
              .slice(0, 15);
            
            validPhrasalVerbs.push(...phrasePhrasalVerbs);
          }
        } catch (err) {
          console.error('Failed to fetch related phrases:', err);
        }
      }
      
      setPhrasalVerbs(validPhrasalVerbs.slice(0, 15));
    } catch (err) {
      console.error('Failed to fetch phrasal verbs:', err);
      setPhrasalVerbs([]);
    } finally {
      setLoadingPhrasalVerbs(false);
    }
  }, []);

  // Check if word exists in dictionary
  const checkWordExists = useCallback(async (term: string): Promise<boolean> => {
    if (!term.trim()) return false;

    if (checkAbortRef.current) {
      checkAbortRef.current.abort();
    }
    checkAbortRef.current = new AbortController();

    try {
      const response = await fetch(
        `${API_URL}${term.trim().toLowerCase()}`,
        { signal: checkAbortRef.current.signal }
      );
      return response.ok;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      return false;
    }
  }, []);

  // Fetch definition from Wordnik API (fallback for phrasal verbs)
  const fetchFromWordnik = useCallback(async (term: string): Promise<DictionaryResponse | null> => {
    if (!term.trim()) return null;

    try {
      const normalizedTerm = term.trim().toLowerCase();
      // Wordnik text endpoint returns definitions
      const response = await fetch(
        `${WORDNIK_BASE_URL}/word.json/${encodeURIComponent(normalizedTerm)}/definitions?limit=10&includeRelated=false&useCanonical=false&includeTags=false`
      );
      
      if (!response.ok) return null;
      
      const definitions: any[] = await response.json();
      if (definitions.length === 0) return null;

      // Group definitions by part of speech
      const meaningsMap = new Map<string, { definition: string; example?: string }[]>();
      
      definitions.forEach((def: any) => {
        const pos = def.partOfSpeech || 'noun';
        const existing = meaningsMap.get(pos) || [];
        existing.push({
          definition: def.text,
          example: def.example,
        });
        meaningsMap.set(pos, existing);
      });

      const meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] = [];
      meaningsMap.forEach((defs, pos) => {
        meanings.push({ partOfSpeech: pos, definitions: defs });
      });

      // Fetch pronunciation from Wordnik
      let phonetic = '';
      try {
        const audioResponse = await fetch(
          `${WORDNIK_BASE_URL}/word.json/${encodeURIComponent(normalizedTerm)}/audio?useCanonical=false&limit=1`
        );
        if (audioResponse.ok) {
          const audioData: any[] = await audioResponse.json();
          if (audioData.length > 0 && audioData[0].fileUrl) {
            // Wordnik provides audio URL directly
            phonetic = audioData[0].attributionText || '';
          }
        }
      } catch (e) {
        // Ignore audio fetch errors
      }

      return {
        word: normalizedTerm,
        phonetic,
        phonetics: [],
        meanings,
      };
    } catch (err) {
      console.error('Failed to fetch from Wordnik:', err);
      return null;
    }
  }, []);

  // Fetch definition from Datamuse API - supports phrases and idioms (FREE, no key required)
  const fetchFromDatamuse = useCallback(async (term: string): Promise<DictionaryResponse | null> => {
    if (!term.trim()) return null;

    try {
      const normalizedTerm = term.trim().toLowerCase();
      
      // Use Datamuse's rel_syn endpoint to get related words with definitions
      // This works for phrases too
      const response = await fetch(
        `${DATAMUSE_DEFINITIONS_URL}?rel_trg=${encodeURIComponent(normalizedTerm)}&md=d&max=10`
      );
      
      if (!response.ok) return null;
      
      const results: any[] = await response.json();
      if (results.length === 0) return null;

      // Group by part of speech if available, otherwise use 'phrase'
      const meaningsMap = new Map<string, { definition: string; example?: string }[]>();
      
      results.forEach((item: any) => {
        // Datamuse returns 'd' field for definitions when md=d parameter is used
        const definition = item.d || item.word;
        if (definition) {
          const pos = 'phrase'; // Datamuse doesn't always provide part of speech
          const existing = meaningsMap.get(pos) || [];
          existing.push({
            definition: typeof definition === 'string' ? definition : String(definition),
          });
          meaningsMap.set(pos, existing);
        }
      });

      const meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] = [];
      meaningsMap.forEach((defs, pos) => {
        meanings.push({ partOfSpeech: pos, definitions: defs });
      });

      if (meanings.length === 0) return null;

      return {
        word: normalizedTerm,
        phonetic: '',
        phonetics: [],
        meanings,
      };
    } catch (err) {
      console.error('Failed to fetch from Datamuse:', err);
      return null;
    }
  }, []);

  // Fetch synonyms from Wordnik API
  const fetchSynonymsFromWordnik = useCallback(async (term: string): Promise<string[]> => {
    if (!term.trim()) return [];

    try {
      const normalizedTerm = term.trim().toLowerCase();
      const response = await fetch(
        `${WORDNIK_BASE_URL}/word.json/${encodeURIComponent(normalizedTerm)}/relatedWords?useCanonical=false&limitTypes=synonym`
      );
      
      if (!response.ok) return [];
      
      const data: any = await response.json();
      const synonymList = data.find((r: any) => r.relationshipType === 'synonym');
      if (synonymList && synonymList.words) {
        return synonymList.words.slice(0, 15);
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch synonyms from Wordnik:', err);
      return [];
    }
  }, []);

  // Debounce suggestions fetch - 100ms for instant response
  const debouncedFetchSuggestions = useMemo(
    () => debounce((term: string) => fetchSuggestions(term), 100),
    [fetchSuggestions]
  );

  // Search function - only called when user finishes typing or clicks suggestion
  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setData(null);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSynonyms([]);
    setPhrasalVerbs([]);

    const normalizedTerm = term.trim().toLowerCase();

    try {
      // First, try the main dictionary API
      const response = await fetch(`${API_URL}${normalizedTerm}`);

      if (!response.ok) {
        // If main API fails, try multiple free fallbacks (especially for phrasal verbs)
        const isPhrasalVerb = normalizedTerm.includes(' ');

        if (isPhrasalVerb) {
          // For phrasal verbs, try free APIs in sequence

          // 1. Try Datamuse API (supports phrases with rel_trg)
          const datamuseData = await fetchFromDatamuse(normalizedTerm);
          if (datamuseData) {
            setData(datamuseData);
            setSearched(true);
            fetchSynonyms(normalizedTerm);
            setLoading(false);
            return;
          }

          // 2. Try Wordnik as last resort (may require API key)
          const wordnikData = await fetchFromWordnik(normalizedTerm);
          if (wordnikData) {
            setData(wordnikData);
            setSearched(true);

            // Try to fetch synonyms from both sources
            const [datamuseSynonyms, wordnikSynonyms] = await Promise.all([
              fetchSynonyms(normalizedTerm).then(() => synonyms).catch(() => []),
              fetchSynonymsFromWordnik(normalizedTerm),
            ]);

            // Combine synonyms, preferring Wordnik for phrasal verbs
            const combinedSynonyms = wordnikSynonyms.length > 0 ? wordnikSynonyms : datamuseSynonyms;
            setSynonyms(combinedSynonyms);
            setLoading(false);
            return;
          }
        }

        // If we get here, no API worked
        if (response.status === 404) {
          throw new Error(`No definitions found for "${term}"`);
        }
        throw new Error('Failed to fetch definition');
      }

      // Main API succeeded
      const results: DictionaryResponse[] = await response.json();
      setData(results[0]);
      setSearched(true);

      // Fetch synonyms and phrasal verbs after successful search (for single words only)
      if (!normalizedTerm.includes(' ')) {
        fetchSynonyms(normalizedTerm);
        fetchPhrasalVerbs(normalizedTerm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [fetchSynonyms, fetchFromWordnik, fetchSynonymsFromWordnik, fetchFromDatamuse, fetchPhrasalVerbs, synonyms]);

  // Debounced search for auto-search after user stops typing (1000ms delay)
  const debouncedSearch = useMemo(
    () => debounce((term: string) => performSearch(term), 1000),
    [performSearch]
  );

  // Handle input change - only fetch suggestions, don't search yet
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(true);
    setNoSuggestions(false);
    setError(null);
    
    // Fetch suggestions while typing
    debouncedFetchSuggestions(value);
  };

  // Handle Enter key press - search immediately
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      setShowSuggestions(false);
      performSearch(searchTerm);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
  }, [performSearch]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (checkAbortRef.current) {
        checkAbortRef.current.abort();
      }
    };
  }, []);

  // Get first available audio URL
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
            English Dictionary
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Look up word definitions, pronunciations, and examples
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Type a word to search..."
              className={cn(
                'w-full rounded-xl border-2 bg-white py-4 pl-12 pr-4 text-lg shadow-sm transition-all focus:outline-none focus:ring-4',
                loading || checkingWord
                  ? 'border-purple-300 focus:border-purple-500 focus:ring-purple-500/20'
                  : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 dark:border-gray-800 dark:bg-gray-900'
              )}
              autoFocus
            />
            {(loading || checkingWord) && (
              <Loader2 className="absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 animate-spin text-purple-500" />
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                {checkingWord ? (
                  <div className="flex items-center gap-3 px-4 py-3 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking "{searchTerm}"...</span>
                  </div>
                ) : loadingSuggestions ? (
                  <div className="flex items-center gap-3 px-4 py-3 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Fetching suggestions...</span>
                  </div>
                ) : suggestions.length > 0 ? (
                  <>
                    {error && (
                      <div className="px-4 py-2 text-sm text-orange-600 dark:text-orange-400 border-b border-gray-100 dark:border-gray-800">
                        <AlertCircle className="inline h-4 w-4 mr-1" />
                        {error}
                      </div>
                    )}
                    {suggestions.map((suggestion, idx) => (
                      <div
                        key={suggestion}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSuggestionClick(suggestion);
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-purple-50 dark:hover:bg-gray-800',
                          idx !== suggestions.length - 1 && 'border-b border-gray-100 dark:border-gray-800'
                        )}
                      >
                        <Search className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-gray-100">{suggestion}</span>
                      </div>
                    ))}
                  </>
                ) : searchTerm.trim().length >= 1 ? (
                  <div className="flex items-center gap-3 px-4 py-3 text-gray-500 dark:text-gray-400">
                    <span>No suggestions found</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <LoadingSkeleton variant="text" />
            <LoadingSkeleton variant="text" count={3} />
          </div>
        )}

        {/* Error State */}
        {error && !checkingWord && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-center dark:border-orange-900 dark:bg-orange-950">
            <AlertCircle className="mx-auto h-12 w-12 text-orange-500" />
            <h3 className="mt-4 text-lg font-semibold text-orange-800 dark:text-orange-200">
              {error.includes('not found') || error.includes('does not exist') ? 'Word Not Found' : 'Error'}
            </h3>
            <p className="mt-2 text-orange-600 dark:text-orange-400">{error}</p>
            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">Did you mean:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left side: Word info + Similar words */}
            <div className="lg:col-span-1 space-y-4">
              {/* Word Header */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div>
                    <h2 className="text-4xl font-bold capitalize text-gray-900 dark:text-gray-100">
                      {data.word}
                    </h2>
                    {data.phonetic && (
                      <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
                        {data.phonetic}
                      </p>
                    )}
                  </div>
                  <AudioPlayer audioUrl={audioUrl} />
                </div>
              </div>

              {/* Similar Words (Synonyms) */}
              {synonyms.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Similar Words
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {synonyms.map((synonym) => (
                      <button
                        key={synonym}
                        onClick={() => handleSuggestionClick(synonym)}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"
                      >
                        {synonym}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading synonyms state */}
              {loadingSynonyms && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading similar words...</span>
                  </div>
                </div>
              )}

              {/* Phrasal Verbs */}
              {phrasalVerbs.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Phrasal Verbs
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {phrasalVerbs.map((phrasalVerb) => (
                      <button
                        key={phrasalVerb}
                        onClick={() => handleSuggestionClick(phrasalVerb)}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                      >
                        {phrasalVerb}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading phrasal verbs state */}
              {loadingPhrasalVerbs && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading phrasal verbs...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Meanings */}
            {data.meanings && data.meanings.length > 0 && (
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Meanings
                </h3>
                <div className="space-y-4">
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
          </div>
        )}

        {/* Empty State */}
        {!searched && !loading && !error && (
          <div className="mt-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Search for a word
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Type any English word above to see its definition
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dictionary với Error Boundary
 */
export function Dictionary() {
  return (
    <ErrorBoundary>
      <DictionaryContent />
    </ErrorBoundary>
  );
}

export default Dictionary;
