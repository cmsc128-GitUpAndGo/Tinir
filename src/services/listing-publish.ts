import type { ListingInput, ManagedListing } from './contracts';
import { backendError } from './errors';
import type { PickedPhoto } from './listing-form';

/** The calls the publish flow needs; the screen passes the real backend, tests pass fakes. */
export interface PublishApi {
  create: (input: ListingInput) => Promise<ManagedListing>;
  update: (id: string, input: ListingInput) => Promise<ManagedListing>;
  upload: (listingId: string, photo: PickedPhoto) => Promise<{ id: string }>;
  removePhoto: (listingId: string, photoId: string) => Promise<unknown>;
  publish: (id: string) => Promise<ManagedListing>;
}

/** What survives a failed attempt, so a retry reuses the draft and skips photos already stored. */
export interface PublishProgress {
  draftId: string | null;
  /** Picked photo key → stored photo ID. */
  uploaded: Record<string, string>;
}

export type PublishStep =
  | { step: 'saving' }
  | { step: 'uploading'; index: number; total: number }
  | { step: 'publishing' };

export type PublishResult =
  | { status: 'published'; listing: ManagedListing; progress: PublishProgress }
  /** The draft is saved but not published, so no listing goes live with missing photos. */
  | { status: 'failed'; stage: 'save' | 'photos' | 'publish'; message: string; photoErrors: Record<string, string>; progress: PublishProgress };

export const initialProgress: PublishProgress = { draftId: null, uploaded: {} };

/**
 * FR9: saves the listing as a draft, uploads its photos one at a time, and publishes only once every
 * photo is stored. Failed photos are reported per photo; the draft and the stored photos are kept for the
 * retry. The server still decides ownership, verification, the photo cap and the publish rules (NFR5).
 */
export async function publishListing(
  input: ListingInput,
  photos: PickedPhoto[],
  previous: PublishProgress,
  api: PublishApi,
  onStep: (step: PublishStep) => void = () => {},
): Promise<PublishResult> {
  const progress: PublishProgress = { draftId: previous.draftId, uploaded: { ...previous.uploaded } };
  const fail = (stage: 'save' | 'photos' | 'publish', message: string, photoErrors: Record<string, string> = {}): PublishResult =>
    ({ status: 'failed', stage, message, photoErrors, progress });

  onStep({ step: 'saving' });
  try {
    progress.draftId = progress.draftId
      ? (await api.update(progress.draftId, input)).id
      : (await api.create(input)).id;
  } catch (error) {
    return fail('save', backendError(error).error.message);
  }
  const draftId = progress.draftId!;

  // Photos removed from the form since the last attempt come off the draft first, freeing their slots.
  const keep = new Set(photos.map((photo) => photo.key));
  for (const [key, photoId] of Object.entries(progress.uploaded)) {
    if (keep.has(key)) continue;
    try {
      await api.removePhoto(draftId, photoId);
      delete progress.uploaded[key];
    } catch (error) {
      return fail('photos', `A removed photo couldn’t be taken off the draft. ${backendError(error).error.message}`);
    }
  }

  const pending = photos.filter((photo) => !progress.uploaded[photo.key]);
  const photoErrors: Record<string, string> = {};
  for (const [index, photo] of pending.entries()) {
    onStep({ step: 'uploading', index: index + 1, total: pending.length });
    try {
      progress.uploaded[photo.key] = (await api.upload(draftId, photo)).id;
    } catch (error) {
      photoErrors[photo.key] = backendError(error).error.message;
      // A rate limit or lost session fails every later upload the same way; stop instead of repeating it.
      if (['RATE_LIMITED', 'UNAUTHENTICATED', 'FORBIDDEN', 'EMAIL_UNVERIFIED', 'NOT_FOUND'].includes(backendError(error).error.code)) break;
    }
  }
  const failed = Object.keys(photoErrors).length;
  const missing = pending.filter((photo) => !progress.uploaded[photo.key]).length;
  if (missing) {
    const first = Object.values(photoErrors)[0];
    return fail('photos', `${missing} of ${photos.length} photos weren’t uploaded${failed ? `: ${first}` : '.'} Your listing is saved as a draft.`, photoErrors);
  }

  onStep({ step: 'publishing' });
  try {
    const listing = await api.publish(draftId);
    return { status: 'published', listing, progress };
  } catch (error) {
    return fail('publish', `${backendError(error).error.message} Your listing is saved as a draft.`);
  }
}
