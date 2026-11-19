import type { ListingDetail } from './contracts';
import { backendError } from './errors';

/** What the listing details screen shows (FR6). */
export type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; listing: ListingDetail }
  /** Not published (draft, archived, removed) or never existed. The server does not say which. */
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Listing IDs are UUIDs; anything else is a mistyped or tampered link and is never sent to the server. */
export function isListingId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

/** Turns a failed detail read into a screen state. Missing listings are not errors the user can retry. */
export function detailFailure(error: unknown): DetailState {
  const failure = backendError(error).error;
  if (failure.code === 'NOT_FOUND' || failure.code === 'INVALID_INPUT') return { status: 'unavailable' };
  return { status: 'error', message: failure.message };
}
