import { useState, useRef, useEffect, useCallback } from 'react';
import type { MarketplaceSkill } from '../types';
import { fetchSkillsSh } from '../lib/market/skills-sh-api';

const DEBOUNCE_MS = 500;
const DEFAULT_QUERY = 'skill'; // Fallback when no search term — gets popular results
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface SearchState {
  results: MarketplaceSkill[];
  isSearching: boolean;
  error: string | null;
}

interface CacheEntry {
  results: MarketplaceSkill[];
  cachedAt: number;
}

// Module-level cache — survives re-renders and HMR
const queryCache = new Map<string, CacheEntry>();

function getCached(key: string): MarketplaceSkill[] | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return entry.results;
}

const MAX_CACHE_SIZE = 50;

function setCache(key: string, results: MarketplaceSkill[]): void {
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldest = queryCache.keys().next().value;
    if (oldest) queryCache.delete(oldest);
  }
  queryCache.set(key, { results, cachedAt: Date.now() });
}

/**
 * React hook for skills.sh search with built-in debounce, abort control, and caching.
 * Cached results are returned immediately without hitting the API again.
 */
export function useSkillsShSearch(query: string, enabled: boolean) {
  const [state, setState] = useState<SearchState>({
    results: [],
    isSearching: false,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Not enabled: cancel and reset
    if (!enabled) {
      cancel();
      return;
    }

    // Cancel previous in-flight request
    cancel();

    const effectiveQuery = query.trim() || DEFAULT_QUERY;

    // Check cache first — return immediately if hit
    const cached = getCached(effectiveQuery);
    if (cached) {
      setState({ results: cached, isSearching: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, isSearching: true, error: null }));

    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      controllerRef.current = controller;

      fetchSkillsSh(effectiveQuery, controller.signal)
        .then(results => {
          if (!controller.signal.aborted) {
            setCache(effectiveQuery, results);
            setState({ results, isSearching: false, error: null });
          }
        })
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (!controller.signal.aborted) {
            setState({ results: [], isSearching: false, error: err?.message ?? 'Search failed' });
          }
        })
        .finally(() => {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }
        });
    }, DEBOUNCE_MS);

    return cancel;
  }, [query, enabled, cancel]);

  // Cleanup on unmount
  useEffect(() => cancel, [cancel]);

  return {
    results: state.results,
    isSearching: state.isSearching,
    error: state.error,
    cancel,
  };
}
