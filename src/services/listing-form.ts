import type { ListingInput, PropertyType } from './contracts';
import { centavos, PRICE_MAX_PESOS } from './listing-search';

/**
 * FR9 proposed upload rules (docs/REQUIREMENTS.md, pending team confirmation): 1–10 photos, JPEG/PNG/WebP,
 * 5 MB each. The media function enforces the same limits and re-encodes every photo without metadata.
 */
export const PHOTO_MIN = 1;
export const PHOTO_MAX = 10;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Server column limits (app_private.listings). */
export const LIMITS = { title: 120, address: 255, area: 100, description: 10000, houseRules: 10000, slots: 999 } as const;

/** A photo the owner picked. `file` is the browser File on web; native uploads use `uri`. */
export interface PickedPhoto {
  key: string;
  uri: string;
  name: string;
  type: string;
  size: number | null;
  file?: Blob;
}

export interface ListingForm {
  title: string;
  type: PropertyType | null;
  address: string;
  area: string;
  description: string;
  houseRules: string;
  /** "latitude, longitude" in decimal degrees, as copied from a map app. */
  coordinates: string;
  /** The owner checked the coordinates on a map. Editing the coordinates clears it. */
  coordinatesConfirmed: boolean;
  /** Proposed default: hidden (FR6/FR9 price-visibility amendment). */
  priceVisible: boolean;
  price: string;
  pricePeriod: 'monthly' | 'semester';
  slots: string;
  availability: 'available' | 'full';
  amenityIds: string[];
  photos: PickedPhoto[];
}

export type ListingField = Exclude<keyof ListingForm, 'priceVisible' | 'pricePeriod' | 'availability' | 'amenityIds'>;
export type ListingErrors = Partial<Record<ListingField, string>>;

export const emptyListing: ListingForm = {
  title: '', type: null, address: '', area: '', description: '', houseRules: '', coordinates: '', coordinatesConfirmed: false,
  priceVisible: false, price: '', pricePeriod: 'monthly', slots: '', availability: 'available', amenityIds: [], photos: [],
};

const DEGREES = /^[-+]?\d{1,3}(\.\d{1,6})?$/;

/**
 * Parses "10.6435, 122.2285" (or space-separated) into decimal degrees with at most six decimals, the
 * precision the server stores. Returns null when the text is not a valid pair.
 */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const parts = text.trim().split(/\s*[,\s]\s*/).filter(Boolean);
  if (parts.length !== 2 || !parts.every((part) => DEGREES.test(part))) return null;
  const [latitude, longitude] = parts.map(Number);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Why a picked file can't be uploaded, or null when it meets the upload rules. */
export function photoProblem(photo: Pick<PickedPhoto, 'type' | 'size'>): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(photo.type)) return 'Use a JPEG, PNG, or WebP photo.';
  if (photo.size !== null && photo.size > PHOTO_MAX_BYTES) return 'This photo is over 5 MB. Choose a smaller one.';
  return null;
}

const tooLong = (value: string, max: number) => value.length > max ? `Use ${max.toLocaleString('en-PH')} characters or fewer.` : undefined;

/**
 * FR9: checks the form and builds the create_listing request. The server repeats every rule; this gives
 * field-level feedback before anything is saved (NFR12).
 */
export function validateListing(form: ListingForm): { ok: true; input: ListingInput } | { ok: false; errors: ListingErrors } {
  const errors: ListingErrors = {};
  const title = form.title.trim();
  const address = form.address.trim();
  const area = form.area.trim();
  const description = form.description.trim();
  const houseRules = form.houseRules.trim();

  if (!title) errors.title = 'Enter a title.';
  else errors.title = tooLong(title, LIMITS.title);
  if (!form.type) errors.type = 'Choose bedspace, room, or apartment.';
  if (!address) errors.address = 'Enter the address.';
  else errors.address = tooLong(address, LIMITS.address);
  errors.area = tooLong(area, LIMITS.area);
  errors.description = tooLong(description, LIMITS.description);
  errors.houseRules = tooLong(houseRules, LIMITS.houseRules);

  const point = parseCoordinates(form.coordinates);
  if (!form.coordinates.trim()) errors.coordinates = 'Enter the coordinates so students can find the place.';
  else if (!point) errors.coordinates = 'Enter latitude and longitude, like 10.643500, 122.228500.';
  else if (!form.coordinatesConfirmed) errors.coordinatesConfirmed = 'Check the pin on the map, then confirm it.';

  // A hidden price may be left blank. An entered amount is kept for the owner only (FR6, FR9).
  const amount = centavos(form.price);
  if (amount === null) {
    if (form.priceVisible) errors.price = 'Enter the price, or hide it to ask students to contact you.';
  } else if (Number.isNaN(amount)) errors.price = 'Enter a peso amount, like 2500 or 2,500.50.';
  else if (amount <= 0) errors.price = 'Enter an amount above ₱0.';
  else if (amount > PRICE_MAX_PESOS * 100) errors.price = `Enter ₱${PRICE_MAX_PESOS.toLocaleString('en-PH')} or less.`;

  const slotsText = form.slots.trim();
  const slots = slotsText ? Number(slotsText) : null;
  if (slotsText && (!/^\d+$/.test(slotsText) || slots! > LIMITS.slots)) errors.slots = `Enter a whole number from 0 to ${LIMITS.slots}.`;

  if (form.photos.length < PHOTO_MIN) errors.photos = 'Add at least one photo.';
  else if (form.photos.length > PHOTO_MAX) errors.photos = `Use up to ${PHOTO_MAX} photos.`;
  else if (form.photos.some((photo) => photoProblem(photo))) errors.photos = 'Remove the photos marked as unsupported.';

  for (const key of Object.keys(errors) as ListingField[]) if (errors[key] === undefined) delete errors[key];
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    input: {
      title,
      property_type: form.type!,
      address,
      area,
      description,
      house_rules: houseRules,
      latitude: point!.latitude,
      longitude: point!.longitude,
      price_visible: form.priceVisible,
      price_amount: amount,
      price_period: form.pricePeriod,
      available_slots: slots,
      availability_status: form.availability,
      amenity_ids: [...form.amenityIds].sort(),
    },
  };
}
