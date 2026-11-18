import type { Href } from 'expo-router';

import { isListingId } from './listing-detail';

/**
 * Where to go after logging in (FR2). Only a listing details page is accepted, so a crafted `next` link can
 * never send someone to another site or an arbitrary route. Anything else falls back to the caller's default.
 */
export function returnPath(value: unknown): Href | null {
  if (typeof value !== 'string') return null;
  const match = /^\/listing\/([^/?#]+)$/.exec(value);
  return match && isListingId(match[1]) ? (value as Href) : null;
}

/** An auth route that remembers where to come back to. */
export function withReturnPath(route: '/auth/login' | '/auth/register', next: Href | null): Href {
  return next ? { pathname: route, params: { next: String(next) } } : route;
}
