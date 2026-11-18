import type { Listing, ListingDetail, PropertyType } from './contracts';

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

/** FR6: availability with the open slot count when the owner gave one, e.g. "Available · 2 slots left". */
export function availabilityLabel(listing: Pick<ListingDetail, 'availability_status' | 'available_slots'>): string {
  if (listing.availability_status === 'full') return 'Full';
  const slots = listing.available_slots;
  if (typeof slots !== 'number' || slots < 1) return 'Available';
  return `Available · ${slots} ${slots === 1 ? 'slot' : 'slots'} left`;
}

/** A calendar date such as "Nov 18, 2026", or an empty string for a missing or invalid timestamp. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** A map search for the listing's published coordinates, or null when the listing has none. */
export function mapUrl(listing: Pick<ListingDetail, 'latitude' | 'longitude'>): `https://${string}` | null {
  const { latitude, longitude } = listing;
  if (latitude === null || longitude === null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
