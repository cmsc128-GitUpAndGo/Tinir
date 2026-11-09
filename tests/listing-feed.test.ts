import { describe, expect, it } from 'vitest';
import type { Listing } from '../src/services/contracts';
import { feedReducer, initialFeed, nextPage, retryMode, type FeedState } from '../src/services/listing-feed';

const listing = (id: string): Listing => ({
  id, title: id, property_type: 'room', area: 'Miagao', price_visible: false, price_period: 'monthly',
  availability_status: 'available', photos: [], amenities: [], created_at: '', updated_at: '',
});
const ids = (state: FeedState) => state.items.map((item) => item.id);

describe('listing feed pagination (FR1)', () => {
  it('loads a full first page and allows another', () => {
    const state = feedReducer(initialFeed, { type: 'page', page: { items: [listing('a'), listing('b')], page: 1, page_size: 2 } });
    expect(ids(state)).toEqual(['a', 'b']);
    expect(state.hasMore).toBe(true);
    expect(nextPage(state, 'loading-more')).toBe(2);
  });

  it('appends later pages without duplicates and stops on a short page', () => {
    let state = feedReducer(initialFeed, { type: 'page', page: { items: [listing('a'), listing('b')], page: 1, page_size: 2 } });
    state = feedReducer(state, { type: 'page', page: { items: [listing('b'), listing('c')], page: 2, page_size: 2 } });
    expect(ids(state)).toEqual(['a', 'b', 'c']);
    state = feedReducer(state, { type: 'page', page: { items: [listing('d')], page: 3, page_size: 2 } });
    expect(ids(state)).toEqual(['a', 'b', 'c', 'd']);
    expect(state.hasMore).toBe(false);
    expect(nextPage(state, 'loading-more')).toBeNull();
  });

  it('replaces the list on refresh', () => {
    let state = feedReducer(initialFeed, { type: 'page', page: { items: [listing('a'), listing('b')], page: 1, page_size: 2 } });
    state = feedReducer(state, { type: 'page', page: { items: [listing('z')], page: 1, page_size: 2 } });
    expect(ids(state)).toEqual(['z']);
    expect(nextPage(state, 'refreshing')).toBe(1);
  });

  it('keeps loaded items on failure and blocks duplicate page loads', () => {
    let state = feedReducer(initialFeed, { type: 'page', page: { items: [listing('a')], page: 1, page_size: 1 } });
    state = feedReducer(state, { type: 'start', mode: 'loading-more' });
    expect(nextPage(state, 'loading-more')).toBeNull();
    state = feedReducer(state, { type: 'fail', message: 'offline' });
    expect(ids(state)).toEqual(['a']);
    expect(state.error).toBe('offline');
    expect(nextPage(state, 'loading-more')).toBe(2);
  });

  describe('retry repeats the failed request', () => {
    const full = () => feedReducer(initialFeed, { type: 'page', page: { items: [listing('a'), listing('b')], page: 1, page_size: 2 } });
    const failRefresh = (state: FeedState) =>
      feedReducer(feedReducer(state, { type: 'start', mode: 'refreshing' }), { type: 'fail', message: 'offline' });

    it('reloads page 1 after a failed refresh of a full page, not page 2', () => {
      const state = failRefresh(full());
      expect(ids(state)).toEqual(['a', 'b']);
      expect(retryMode(state)).toBe('refreshing');
      expect(nextPage(state, retryMode(state))).toBe(1);
    });

    it('reloads page 1 after a failed refresh following the final short page', () => {
      let state = feedReducer(full(), { type: 'page', page: { items: [listing('c')], page: 2, page_size: 2 } });
      expect(state.hasMore).toBe(false);
      state = failRefresh(state);
      expect(retryMode(state)).toBe('refreshing');
      expect(nextPage(state, retryMode(state))).toBe(1);
      state = feedReducer(state, { type: 'page', page: { items: [listing('z')], page: 1, page_size: 2 } });
      expect(ids(state)).toEqual(['z']);
      expect(state.error).toBeNull();
    });

    it('requests the same next page after a failed page load', () => {
      let state = feedReducer(full(), { type: 'start', mode: 'loading-more' });
      state = feedReducer(state, { type: 'fail', message: 'offline' });
      expect(retryMode(state)).toBe('loading-more');
      expect(nextPage(state, retryMode(state))).toBe(2);
    });

    it('repeats the first load when nothing has loaded', () => {
      const state = feedReducer(feedReducer(initialFeed, { type: 'start', mode: 'loading' }), { type: 'fail', message: 'offline' });
      expect(retryMode(state)).toBe('loading');
      expect(nextPage(state, retryMode(state))).toBe(1);
    });
  });
});
