import { describe, expect, it } from 'vitest';
import { emptyListing, parseCoordinates, photoProblem, validateListing, type ListingForm, type PickedPhoto } from '../src/services/listing-form';

const photo = (patch: Partial<PickedPhoto> = {}): PickedPhoto =>
  ({ key: 'a', uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg', size: 1000, ...patch });
const valid: ListingForm = {
  ...emptyListing,
  title: '  Room near campus ', type: 'room', address: ' 1 Fake St, Miagao ', coordinates: '10.6435, 122.2285',
  coordinatesConfirmed: true, photos: [photo()],
};
const form = (patch: Partial<ListingForm>): ListingForm => ({ ...valid, ...patch });

describe('listing form (FR9)', () => {
  it('builds a create request with trimmed text and a hidden price by default', () => {
    const result = validateListing(form({ amenityIds: ['b', 'a'] }));
    expect(result).toEqual({
      ok: true,
      input: {
        title: 'Room near campus', property_type: 'room', address: '1 Fake St, Miagao', area: '', description: '', house_rules: '',
        latitude: 10.6435, longitude: 122.2285, price_visible: false, price_amount: null, price_period: 'monthly',
        available_slots: null, availability_status: 'available', amenity_ids: ['a', 'b'],
      },
    });
  });

  it('lets a hidden price be blank, but keeps a valid hidden amount for the owner', () => {
    expect(validateListing(form({ priceVisible: false, price: '' })).ok).toBe(true);
    expect(validateListing(form({ priceVisible: false, price: '3,500' }))).toMatchObject({ ok: true, input: { price_amount: 350000, price_visible: false } });
  });

  it('requires a positive amount when the price is shown', () => {
    expect(validateListing(form({ priceVisible: true, price: '' }))).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
    expect(validateListing(form({ priceVisible: true, price: '0' }))).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
    expect(validateListing(form({ priceVisible: true, price: '2,50' }))).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
    expect(validateListing(form({ priceVisible: true, price: '1000000.01' }))).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
    expect(validateListing(form({ priceVisible: true, price: '2,500.50', pricePeriod: 'semester' })))
      .toMatchObject({ ok: true, input: { price_amount: 250050, price_visible: true, price_period: 'semester' } });
  });

  it('requires title, type, address, confirmed coordinates and a photo', () => {
    const result = validateListing({ ...emptyListing });
    expect(result).toMatchObject({ ok: false, errors: { title: expect.any(String), type: expect.any(String), address: expect.any(String), coordinates: expect.any(String), photos: expect.any(String) } });
    expect(validateListing(form({ coordinatesConfirmed: false }))).toMatchObject({ ok: false, errors: { coordinatesConfirmed: expect.any(String) } });
  });

  it('enforces server length limits and whole-number slots', () => {
    expect(validateListing(form({ title: 'x'.repeat(121) }))).toMatchObject({ ok: false, errors: { title: expect.any(String) } });
    expect(validateListing(form({ address: 'x'.repeat(256) }))).toMatchObject({ ok: false, errors: { address: expect.any(String) } });
    expect(validateListing(form({ description: 'x'.repeat(10001) }))).toMatchObject({ ok: false, errors: { description: expect.any(String) } });
    for (const slots of ['-1', '1.5', 'two', '1000']) expect(validateListing(form({ slots })).ok, slots).toBe(false);
    expect(validateListing(form({ slots: ' 3 ' }))).toMatchObject({ ok: true, input: { available_slots: 3 } });
  });

  it('limits photos to 1–10 supported images', () => {
    const many = Array.from({ length: 11 }, (_, i) => photo({ key: String(i) }));
    expect(validateListing(form({ photos: many }))).toMatchObject({ ok: false, errors: { photos: expect.any(String) } });
    expect(validateListing(form({ photos: [photo({ type: 'image/gif' })] }))).toMatchObject({ ok: false, errors: { photos: expect.any(String) } });
  });
});

describe('coordinates', () => {
  it('reads a pasted latitude, longitude pair', () => {
    expect(parseCoordinates('10.643500, 122.228500')).toEqual({ latitude: 10.6435, longitude: 122.2285 });
    expect(parseCoordinates(' -10.5 122 ')).toEqual({ latitude: -10.5, longitude: 122 });
  });

  it('rejects out-of-range, over-precise and malformed values', () => {
    for (const text of ['', '91, 0', '0, 181', '10.1234567, 122', '10', '10, 20, 30', 'abc, def', '1e1, 2']) {
      expect(parseCoordinates(text), text).toBeNull();
    }
  });
});

describe('photo rules', () => {
  it('accepts JPEG, PNG and WebP up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(photoProblem({ type, size: 5 * 1024 * 1024 })).toBeNull();
    expect(photoProblem({ type: 'image/jpeg', size: null })).toBeNull();
  });

  it('rejects other types and oversized files', () => {
    expect(photoProblem({ type: 'image/heic', size: 10 })).toMatch(/JPEG/);
    expect(photoProblem({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});
