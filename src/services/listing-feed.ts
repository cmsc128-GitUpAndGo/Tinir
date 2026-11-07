import type { Listing, Page } from './contracts';

export const FEED_PAGE_SIZE = 20;

export interface FeedState {
  items: Listing[];
  /** Last page successfully loaded; 0 before the first response. */
  page: number;
  hasMore: boolean;
  status: 'loading' | 'ready' | 'refreshing' | 'loading-more' | 'error';
  error: string | null;
}

export const initialFeed: FeedState = { items: [], page: 0, hasMore: true, status: 'loading', error: null };

export type FeedAction =
  | { type: 'start'; mode: 'loading' | 'refreshing' | 'loading-more' }
  | { type: 'page'; page: Page<Listing> }
  | { type: 'fail'; message: string };

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'start':
      return { ...state, status: action.mode, error: null };
    case 'page': {
      const { items, page, page_size } = action.page;
      // Page 1 replaces the list (initial load or pull-to-refresh); later pages append without duplicates.
      const base = page === 1 ? [] : state.items;
      const seen = new Set(base.map((item) => item.id));
      return {
        items: [...base, ...items.filter((item) => !seen.has(item.id))],
        page,
        // The API has no total count, so a short page marks the end.
        hasMore: items.length === page_size,
        status: 'ready',
        error: null,
      };
    }
    case 'fail':
      return { ...state, status: 'error', error: action.message };
  }
}

/** The page to request for a given action, or null when nothing should load. */
export function nextPage(state: FeedState, mode: 'loading' | 'refreshing' | 'loading-more'): number | null {
  if (mode !== 'loading-more') return 1;
  // A failed page can be retried; a page already in flight cannot be requested twice.
  if (!state.hasMore || (state.status !== 'ready' && state.status !== 'error')) return null;
  return state.page + 1;
}
