import { describe, expect, it } from 'vitest';
import { returnPath, withReturnPath } from '../src/services/return-path';

const listing = '/listing/7f1c2a9e-3b4d-4c5e-8f90-1a2b3c4d5e6f';

describe('return to the listing after logging in (FR2)', () => {
  it('accepts a listing details path', () => {
    expect(returnPath(listing)).toBe(listing);
  });

  it('rejects other sites, other routes, and malformed values', () => {
    for (const value of [
      'https://example.com/listing/7f1c2a9e-3b4d-4c5e-8f90-1a2b3c4d5e6f', '//example.com', '/\\example.com',
      '/account', '/listing/not-a-uuid', `${listing}?x=1`, `${listing}/../../account`, `javascript:alert(1)`,
      '', undefined, [listing], 42,
    ]) {
      expect(returnPath(value), String(value)).toBeNull();
    }
  });

  it('carries the return path to the auth screens only when there is one', () => {
    expect(withReturnPath('/auth/login', listing)).toEqual({ pathname: '/auth/login', params: { next: listing } });
    expect(withReturnPath('/auth/register', null)).toBe('/auth/register');
  });
});
