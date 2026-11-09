import type { Listing, Page } from './contracts';

export const FEED_PAGE_SIZE = 20;

/** Any paged record list keyed by id: public listings, saved listings, inquiries, owner listings. */
export interface FeedState<T extends { id: string } = Listing> {
  items: T[];
  /** Last page successfully loaded; 0 before the first response. */
  page: number;
  hasMore: boolean;
  status: 'loading' | 'ready' | 'refreshing' | 'loading-more' | 'error';
  error: string | null;
  /** The request that produced `error`, so a retry repeats it rather than guessing from the items shown. */
  failed: FeedMode | null;
}

export type FeedMode = 'loading' | 'refreshing' | 'loading-more';

export const initialFeed: FeedState<never> = { items: [], page: 0, hasMore: true, status: 'loading', error: null, failed: null };

export type FeedAction<T extends { id: string } = Listing> =
  | { type: 'start'; mode: FeedMode }
  | { type: 'page'; page: Page<T> }
  | { type: 'fail'; message: string };

export function feedReducer<T extends { id: string }>(state: FeedState<T>, action: FeedAction<T>): FeedState<T> {
  switch (action.type) {
    case 'start':
      return { ...state, status: action.mode, error: null, failed: null };
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
        failed: null,
      };
    }
    case 'fail':
      // `status` still names the request that was in flight.
      return { ...state, status: 'error', error: action.message, failed: state.status === 'ready' || state.status === 'error' ? null : state.status };
  }
}

/** The page to request for a given action, or null when nothing should load. */
export function nextPage(state: FeedState<{ id: string }>, mode: FeedMode): number | null {
  if (mode !== 'loading-more') return 1;
  // A failed page can be retried; a page already in flight cannot be requested twice.
  if (!state.hasMore || (state.status !== 'ready' && state.status !== 'error')) return null;
  return state.page + 1;
}

/** What "Try again" repeats: the failed request. A failed refresh reloads page 1 even when older items remain. */
export function retryMode(state: FeedState<{ id: string }>): FeedMode {
  return state.failed ?? (state.items.length ? 'refreshing' : 'loading');
}
