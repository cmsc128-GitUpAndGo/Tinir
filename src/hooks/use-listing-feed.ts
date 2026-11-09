import { useCallback, useEffect, useReducer, useRef } from 'react';

import { isBackendConfigured } from '@/lib/supabase/client';
import { listings } from '@/services/backend';
import { backendError } from '@/services/errors';
import { FEED_PAGE_SIZE, feedReducer, initialFeed, nextPage, retryMode, type FeedMode as Mode } from '@/services/listing-feed';

/** Paged public listings (FR1). The server returns only published listings and guest-safe fields. */
export function useListingFeed() {
  const [state, dispatch] = useReducer(feedReducer, initialFeed);
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
      const result = await listings.list({ page, page_size: FEED_PAGE_SIZE });
      if (id === request.current) dispatch({ type: 'page', page: result });
    } catch (error) {
      if (id !== request.current) return;
      const message = isBackendConfigured()
        ? backendError(error).error.message
        : 'Listings are unavailable because the app is not connected to the backend.';
      dispatch({ type: 'fail', message });
    } finally {
      if (id === request.current) inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    void load('loading');
  }, [load]);

  return {
    ...state,
    refresh: useCallback(() => load('refreshing'), [load]),
    loadMore: useCallback(() => load('loading-more'), [load]),
    retry: useCallback(() => load(retryMode(latest.current)), [load]),
  };
}
