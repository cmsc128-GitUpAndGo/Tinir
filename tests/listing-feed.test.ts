import { describe, expect, it } from 'vitest';
import type { Listing } from '../src/services/contracts';
import { feedReducer, initialFeed, nextPage, type FeedState } from '../src/services/listing-feed';

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
});
