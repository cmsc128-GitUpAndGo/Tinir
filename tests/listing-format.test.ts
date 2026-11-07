import { describe, expect, it } from 'vitest';
import { formatPeso, priceLabel, propertyTypeLabel } from '../src/services/listing-format';

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
