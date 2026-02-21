import { useState, useRef, useEffect, useCallback } from 'react';
import type { MarketplaceSkill } from '../types';
import { fetchSkillsSh } from '../lib/market/skills-sh-api';

const DEBOUNCE_MS = 500;
const DEFAULT_QUERY = 'skill'; // Fallback when no search term — gets popular results

interface SearchState {
  results: MarketplaceSkill[];
  isSearching: boolean;
  error: string | null;
}

/**
 * React hook for skills.sh search with built-in debounce and abort control.
 * All mutable state (timer, controller) lives in refs — HMR-safe.
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
    // Not enabled or empty query: cancel and reset
    if (!enabled) {
      cancel();
      return;
    }

    // Cancel previous
    cancel();

    const effectiveQuery = query.trim() || DEFAULT_QUERY;

    setState(prev => ({ ...prev, isSearching: true, error: null }));

    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      controllerRef.current = controller;

      fetchSkillsSh(effectiveQuery, controller.signal)
        .then(results => {
          if (!controller.signal.aborted) {
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
