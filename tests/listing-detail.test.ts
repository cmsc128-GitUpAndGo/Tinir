import { describe, expect, it } from 'vitest';
import { detailFailure, isListingId } from '../src/services/listing-detail';

describe('listing details states (FR6, NFR12)', () => {
  it('accepts only UUID listing IDs', () => {
    expect(isListingId('7f1c2a9e-3b4d-4c5e-8f90-1a2b3c4d5e6f')).toBe(true);
    expect(isListingId('not-a-listing')).toBe(false);
    expect(isListingId("1' or '1'='1")).toBe(false);
    expect(isListingId(undefined)).toBe(false);
    expect(isListingId(['7f1c2a9e-3b4d-4c5e-8f90-1a2b3c4d5e6f'])).toBe(false);
  });

  it('treats missing, unpublished, and malformed listings as unavailable rather than retryable', () => {
    expect(detailFailure({ message: '{"code":"NOT_FOUND","message":"Listing not found."}' })).toEqual({ status: 'unavailable' });
    expect(detailFailure({ code: '22P02' })).toEqual({ status: 'unavailable' });
  });

  it('offers a retry for connection and server failures without exposing raw diagnostics', () => {
    const failed = detailFailure({ message: 'connection reset while reading owner contacts', code: 'XX000' });
    expect(failed.status).toBe('error');
    expect(JSON.stringify(failed)).not.toContain('owner contacts');
  });
});
