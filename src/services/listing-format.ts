import type { Listing, PropertyType } from './contracts';

const typeLabels: Record<PropertyType, string> = { bedspace: 'Bedspace', room: 'Room', apartment: 'Apartment' };

export function propertyTypeLabel(type: PropertyType): string {
  return typeLabels[type] ?? 'Accommodation';
}

/** Formats integer centavos as whole or two-decimal pesos, e.g. 250000 -> "₱2,500". */
export function formatPeso(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const whole = String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${whole}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
}

/** FR1/FR6: show an amount only when the owner disclosed it and the server returned it. */
export function priceLabel(listing: Pick<Listing, 'price_visible' | 'price_amount' | 'price_period'>): string {
  if (!listing.price_visible || typeof listing.price_amount !== 'number') return 'Contact owner for price';
  return `${formatPeso(listing.price_amount)} / ${listing.price_period === 'semester' ? 'semester' : 'month'}`;
}
