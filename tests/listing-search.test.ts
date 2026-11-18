import { describe, expect, it } from 'vitest';
import { activeFilterCount, emptySearch, hasPriceRange, toFilters, type SearchForm } from '../src/services/listing-search';

const form = (patch: Partial<SearchForm>): SearchForm => ({ ...emptySearch, ...patch });

describe('listing search filters (FR12)', () => {
  it('sends nothing for an empty form', () => {
    expect(toFilters(emptySearch)).toEqual({ ok: true, filters: {} });
  });

  it('combines keyword, type, peso range in centavos, and amenities', () => {
    expect(toFilters(form({ q: '  Sapa ', type: 'room', minPrice: '1,500', maxPrice: '4000', amenities: ['Wi-Fi', 'Kitchen'] })))
      .toEqual({ ok: true, filters: { q: 'Sapa', type: 'room', min_price: 150000, max_price: 400000, amenities: ['Kitchen', 'Wi-Fi'] } });
  });

  it('accepts one side of a price range', () => {
    expect(toFilters(form({ maxPrice: '3000' }))).toEqual({ ok: true, filters: { max_price: 300000 } });
  });

  it('rejects non-whole, negative, oversized, and inverted price ranges', () => {
    expect(toFilters(form({ minPrice: '15.50' }))).toMatchObject({ ok: false, errors: { minPrice: expect.any(String) } });
    expect(toFilters(form({ minPrice: '-1' }))).toMatchObject({ ok: false, errors: { minPrice: expect.any(String) } });
    expect(toFilters(form({ maxPrice: 'abc' }))).toMatchObject({ ok: false, errors: { maxPrice: expect.any(String) } });
    expect(toFilters(form({ maxPrice: '1000001' }))).toMatchObject({ ok: false, errors: { maxPrice: expect.any(String) } });
    expect(toFilters(form({ minPrice: '5000', maxPrice: '2000' }))).toMatchObject({ ok: false, errors: { maxPrice: expect.any(String) } });
  });

  it('rejects a keyword longer than the server accepts', () => {
    expect(toFilters(form({ q: 'x'.repeat(201) }))).toMatchObject({ ok: false, errors: { q: expect.any(String) } });
    expect(toFilters(form({ q: 'x'.repeat(200) })).ok).toBe(true);
  });

  it('counts active filters and notices a price range', () => {
    expect(activeFilterCount(form({ type: 'bedspace', minPrice: '1000', maxPrice: '2000', amenities: ['Wi-Fi', 'CCTV'] }))).toBe(4);
    expect(activeFilterCount(form({ q: 'Miagao' }))).toBe(0);
    expect(hasPriceRange({ min_price: 100 })).toBe(true);
    expect(hasPriceRange({ q: 'x' })).toBe(false);
  });
});
