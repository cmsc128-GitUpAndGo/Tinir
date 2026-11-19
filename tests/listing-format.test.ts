import { describe, expect, it } from 'vitest';
import { availabilityLabel, formatDate, formatPeso, mapUrl, priceLabel, propertyTypeLabel } from '../src/services/listing-format';

describe('listing formatting (FR1, FR6)', () => {
  it('formats centavos as pesos', () => {
    expect(formatPeso(250000)).toBe('₱2,500');
    expect(formatPeso(123456789)).toBe('₱1,234,567.89');
    expect(formatPeso(5)).toBe('₱0.05');
  });

  it('shows a price only when the owner disclosed it', () => {
    expect(priceLabel({ price_visible: true, price_amount: 350000, price_period: 'monthly' })).toBe('₱3,500 / month');
    expect(priceLabel({ price_visible: true, price_amount: 1800000, price_period: 'semester' })).toBe('₱18,000 / semester');
    expect(priceLabel({ price_visible: false, price_period: 'monthly' })).toBe('Contact owner for price');
    // Even if an amount leaked, a hidden price never renders.
    expect(priceLabel({ price_visible: false, price_amount: 350000, price_period: 'monthly' })).toBe('Contact owner for price');
    expect(priceLabel({ price_visible: true, price_amount: null, price_period: 'monthly' })).toBe('Contact owner for price');
  });

  it('labels property types', () => {
    expect(propertyTypeLabel('bedspace')).toBe('Bedspace');
    expect(propertyTypeLabel('apartment')).toBe('Apartment');
  });
});

describe('listing details formatting (FR6)', () => {
  it('describes availability with the open slot count', () => {
    expect(availabilityLabel({ availability_status: 'full', available_slots: 3 })).toBe('Full');
    expect(availabilityLabel({ availability_status: 'available', available_slots: 1 })).toBe('Available · 1 slot left');
    expect(availabilityLabel({ availability_status: 'available', available_slots: 4 })).toBe('Available · 4 slots left');
    expect(availabilityLabel({ availability_status: 'available', available_slots: null })).toBe('Available');
    expect(availabilityLabel({ availability_status: 'available', available_slots: 0 })).toBe('Available');
  });

  it('formats dates and ignores missing or invalid timestamps', () => {
    expect(formatDate('2026-11-18T04:00:00Z')).toMatch(/2026/);
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });

  it('links to a map only when the listing has coordinates', () => {
    expect(mapUrl({ latitude: 10.643, longitude: 122.235 })).toBe('https://www.google.com/maps/search/?api=1&query=10.643,122.235');
    expect(mapUrl({ latitude: null, longitude: 122.235 })).toBeNull();
  });
});
