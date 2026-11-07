import { useCallback, useEffect, useReducer, useRef } from 'react';

import { isBackendConfigured } from '@/lib/supabase/client';
import { listings } from '@/services/backend';
import type { Page, PageRequest } from '@/services/contracts';
import { backendError } from '@/services/errors';
import { FEED_PAGE_SIZE, feedReducer, initialFeed, nextPage, type FeedState } from '@/services/listing-feed';

type Mode = 'loading' | 'refreshing' | 'loading-more';

/**
 * Paged records from one backend read. `fetchPage` must be stable (a module-level function), and the
 * server decides what the caller may see; this hook only pages through it.
 */
export function usePagedFeed<T extends { id: string }>(fetchPage: (page: PageRequest) => Promise<Page<T>>) {
  const [state, dispatch] = useReducer(feedReducer<T>, initialFeed as FeedState<T>);
  const latest = useRef(state);
  const inFlight = useRef<Mode | null>(null);
  const request = useRef(0);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  const load = useCallback(async (mode: Mode) => {
    // Refresh may supersede a page load; a second page load waits for the first.
    if (mode === 'loading-more' && inFlight.current) return;
    const page = nextPage(latest.current, mode);
    if (page === null) return;
    const id = ++request.current;
    inFlight.current = mode;
    dispatch({ type: 'start', mode });
    try {
      if (!isBackendConfigured()) throw new Error('not configured');
      const result = await fetchPage({ page, page_size: FEED_PAGE_SIZE });
      if (id === request.current) dispatch({ type: 'page', page: result });
    } catch (error) {
      if (id !== request.current) return;
      const message = isBackendConfigured()
        ? backendError(error).error.message
        : 'This list is unavailable because the app is not connected to the backend.';
      dispatch({ type: 'fail', message });
    } finally {
      if (id === request.current) inFlight.current = null;
    }
  }, [fetchPage]);

  useEffect(() => {
    void load('loading');
  }, [load]);

  return {
    ...state,
    refresh: useCallback(() => load('refreshing'), [load]),
    loadMore: useCallback(() => load('loading-more'), [load]),
    retry: useCallback(() => load(latest.current.items.length ? 'loading-more' : 'loading'), [load]),
  };
}

/** Paged public listings (FR1). The server returns only published listings and guest-safe fields. */
export const useListingFeed = () => usePagedFeed(listings.list);
