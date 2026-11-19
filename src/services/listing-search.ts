import type { ListingFilters, PropertyType } from './contracts';

/** What the Browse search form holds. Prices are typed in pesos (up to two decimals); the server works in centavos. */
export interface SearchForm {
  q: string;
  type: PropertyType | null;
  minPrice: string;
  maxPrice: string;
  amenities: string[];
}
export type SearchErrors = Partial<Record<'q' | 'minPrice' | 'maxPrice', string>>;

export const emptySearch: SearchForm = { q: '', type: null, minPrice: '', maxPrice: '', amenities: [] };

/** Server limit on the keyword (tinir_read `listings`). */
export const KEYWORD_MAX = 200;
/** Highest price filter accepted, in pesos. Keeps centavo amounts well inside a 32-bit integer. */
export const PRICE_MAX_PESOS = 1_000_000;

/** Plain digits or correctly grouped thousands, then up to two decimal places. */
const PESO_AMOUNT = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;

/**
 * Pesos such as "2,500", "2500" or "2,500.50" to integer centavos; null when empty; NaN when not a
 * valid amount. Grouping is checked before the commas are removed, so "2,50" is not read as 250.
 */
function centavos(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!PESO_AMOUNT.test(text)) return Number.NaN;
  const [whole, fraction = ''] = text.replace(/,/g, '').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * FR12: turns the form into server filters, or explains what to fix. The server repeats every check;
 * this only keeps an invalid range from replacing the results the student is looking at.
 */
export function toFilters(form: SearchForm): { ok: true; filters: ListingFilters } | { ok: false; errors: SearchErrors } {
  const errors: SearchErrors = {};
  const q = form.q.trim();
  if (q.length > KEYWORD_MAX) errors.q = `Use ${KEYWORD_MAX} characters or fewer.`;
  const min = centavos(form.minPrice);
  const max = centavos(form.maxPrice);
  for (const [key, amount] of [['minPrice', min], ['maxPrice', max]] as const) {
    if (amount === null) continue;
    if (Number.isNaN(amount)) errors[key] = 'Enter a peso amount, like 2500 or 2,500.50.';
    else if (amount > PRICE_MAX_PESOS * 100) errors[key] = `Enter ₱${PRICE_MAX_PESOS.toLocaleString('en-PH')} or less.`;
  }
  if (!errors.minPrice && !errors.maxPrice && min !== null && max !== null && min > max) {
    errors.maxPrice = 'The maximum must be at least the minimum.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const filters: ListingFilters = {};
  if (q) filters.q = q;
  if (form.type) filters.type = form.type;
  if (min !== null) filters.min_price = min;
  if (max !== null) filters.max_price = max;
  if (form.amenities.length) filters.amenities = [...form.amenities].sort();
  return { ok: true, filters };
}

/** How many filters (besides the keyword) are on, for the Filters button. */
export function activeFilterCount(form: SearchForm): number {
  return (form.type ? 1 : 0) + (form.minPrice.trim() || form.maxPrice.trim() ? 1 : 0) + form.amenities.length;
}

/** Whether a price range is in use; listings with a hidden price are then left out by the server. */
export function hasPriceRange(filters: ListingFilters): boolean {
  return filters.min_price !== undefined || filters.max_price !== undefined;
}

export function isFiltered(filters: ListingFilters): boolean {
  return Object.keys(filters).length > 0;
}
