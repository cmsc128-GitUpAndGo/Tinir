import { describe, expect, it, vi } from 'vitest';
import type { ListingInput, ManagedListing } from '../src/services/contracts';
import { BackendError } from '../src/services/errors';
import type { PickedPhoto } from '../src/services/listing-form';
import { initialProgress, publishListing, type PublishApi } from '../src/services/listing-publish';

const input: ListingInput = { title: 'Room', property_type: 'room', address: '1 Fake St' };
const photo = (key: string): PickedPhoto => ({ key, uri: `file:///${key}.jpg`, name: `${key}.jpg`, type: 'image/jpeg', size: 10 });
const listing = (status: ManagedListing['status']) => ({ id: 'draft-1', status }) as ManagedListing;

function api(overrides: Partial<PublishApi> = {}) {
  return {
    create: vi.fn(async () => listing('draft')),
    update: vi.fn(async () => listing('draft')),
    upload: vi.fn(async (_id: string, p: PickedPhoto) => ({ id: `stored-${p.key}` })),
    removePhoto: vi.fn(async () => ({ removed: true })),
    publish: vi.fn(async () => listing('published')),
    ...overrides,
  } satisfies PublishApi;
}

describe('publishing a new listing (FR9)', () => {
  it('creates a draft, uploads every photo in order, then publishes', async () => {
    const calls = api();
    const steps: unknown[] = [];
    const result = await publishListing(input, [photo('a'), photo('b')], initialProgress, calls, (s) => steps.push(s));
    expect(result).toMatchObject({ status: 'published', progress: { draftId: 'draft-1', uploaded: { a: 'stored-a', b: 'stored-b' } } });
    expect(vi.mocked(calls.upload).mock.calls.map(([, p]) => p.key)).toEqual(['a', 'b']);
    expect(calls.publish).toHaveBeenCalledWith('draft-1');
    expect(steps).toEqual([{ step: 'saving' }, { step: 'uploading', index: 1, total: 2 }, { step: 'uploading', index: 2, total: 2 }, { step: 'publishing' }]);
  });

  it('does not publish when a photo fails, and reports it per photo', async () => {
    const calls = api({
      upload: vi.fn(async (_id: string, p: PickedPhoto) => {
        if (p.key === 'b') throw new BackendError('INVALID_INPUT', 'Use a valid JPEG, PNG, or WebP image of 5 MB or less.');
        return { id: `stored-${p.key}` };
      }),
    });
    const result = await publishListing(input, [photo('a'), photo('b'), photo('c')], initialProgress, calls);
    expect(result).toMatchObject({ status: 'failed', stage: 'photos', photoErrors: { b: expect.stringMatching(/JPEG/) }, progress: { uploaded: { a: 'stored-a', c: 'stored-c' } } });
    expect(calls.publish).not.toHaveBeenCalled();
  });

  it('stops uploading after a rate limit instead of failing every photo', async () => {
    const calls = api({ upload: vi.fn(async () => { throw new BackendError('RATE_LIMITED', 'Too many uploads.'); }) });
    const result = await publishListing(input, [photo('a'), photo('b')], initialProgress, calls);
    expect(calls.upload).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'failed', stage: 'photos' });
    if (result.status === 'failed') expect(result.message).toMatch(/2 of 2 photos/);
  });

  it('retries with the same draft, removes dropped photos, and uploads only the missing ones', async () => {
    const calls = api();
    const previous = { draftId: 'draft-1', uploaded: { a: 'stored-a', gone: 'stored-gone' } };
    const result = await publishListing(input, [photo('a'), photo('b')], previous, calls);
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.update).toHaveBeenCalledWith('draft-1', input);
    expect(calls.removePhoto).toHaveBeenCalledWith('draft-1', 'stored-gone');
    expect(vi.mocked(calls.upload).mock.calls.map(([, p]) => p.key)).toEqual(['b']);
    expect(result).toMatchObject({ status: 'published', progress: { uploaded: { a: 'stored-a', b: 'stored-b' } } });
  });

  it('keeps nothing when the draft cannot be saved', async () => {
    const calls = api({ create: vi.fn(async () => { throw new BackendError('FORBIDDEN', 'This action is not available for your role.'); }) });
    const result = await publishListing(input, [photo('a')], initialProgress, calls);
    expect(result).toMatchObject({ status: 'failed', stage: 'save', message: 'This action is not available for your role.', progress: { draftId: null } });
    expect(calls.upload).not.toHaveBeenCalled();
  });

  it('keeps the draft and its photos when publishing fails', async () => {
    const calls = api({ publish: vi.fn(async () => { throw new BackendError('INVALID_INPUT', 'Upload at least one photo before publishing.'); }) });
    const result = await publishListing(input, [photo('a')], initialProgress, calls);
    expect(result).toMatchObject({ status: 'failed', stage: 'publish', progress: { draftId: 'draft-1', uploaded: { a: 'stored-a' } } });
  });
});
