import { getSupabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import type { Campus, Decision, Distance, Inquiry, Listing, ListingDetail, ListingFilters, ListingInput, ManagedListing, Page, PageRequest, Profile, Reminder } from './contracts';
import { backendError, BackendError } from './errors';

type ReadOperation = 'listings' | 'listing' | 'amenities' | 'campuses' | 'profile' | 'owner_listings' | 'saved_listings' | 'student_inquiries' | 'owner_inquiries' | 'reminders' | 'distance';
type WriteOperation = 'create_listing' | 'update_listing' | 'publish_listing' | 'archive_listing' | 'reconfirm_listing' | 'send_inquiry' | 'update_inquiry' | 'save_listing';
// One transport boundary; identity and disclosure are enforced by the database, never these casts.
async function call<T>(method: 'tinir_read' | 'tinir_write', operation: ReadOperation | WriteOperation, args: object = {}): Promise<T> {
  const { data, error } = await getSupabase().rpc(method, { operation, args: args as Json });
  if (error) throw backendError(error);
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
    const failure = data.error as { code: string; message: string };
    throw new BackendError(failure.code, failure.message);
  }
  return data as T;
}
export const listings = {
  list: (filters: ListingFilters = {}) => call<Page<Listing>>('tinir_read', 'listings', filters),
  get: (id: string) => call<ListingDetail>('tinir_read', 'listing', { id }),
  amenities: () => call<{ id: string; name: string }[]>('tinir_read', 'amenities'),
  campuses: () => call<Campus[]>('tinir_read', 'campuses'),
  own: (page: PageRequest = {}) => call<Page<ManagedListing>>('tinir_read', 'owner_listings', page),
  create: (input: ListingInput) => call<ManagedListing>('tinir_write', 'create_listing', input),
  update: (id: string, input: Partial<ListingInput>) => call<ManagedListing>('tinir_write', 'update_listing', { ...input, id }),
  publish: (id: string) => call<ManagedListing>('tinir_write', 'publish_listing', { id }),
  archive: (id: string) => call<ManagedListing>('tinir_write', 'archive_listing', { id }),
  reconfirm: (id: string) => call<ManagedListing>('tinir_write', 'reconfirm_listing', { id }),
  distance: (id: string, campusId: string) => call<Distance>('tinir_read', 'distance', { id, campus_id: campusId }),
};
export const inquiries = {
  send: (listingId: string, type: 'interest' | 'question', message?: string) => call<{ id: string }>('tinir_write', 'send_inquiry', { listing_id: listingId, type, message }),
  sent: (page: PageRequest = {}) => call<Page<Inquiry>>('tinir_read', 'student_inquiries', page),
  received: (filters: PageRequest & { listing_id?: string; status?: Decision } = {}) => call<Page<Inquiry>>('tinir_read', 'owner_inquiries', filters),
  update: (id: string, input: { status?: Decision; mark_read?: boolean }) => call<Inquiry>('tinir_write', 'update_inquiry', { ...input, id }),
};
export const savedListings = {
  list: (page: PageRequest = {}) => call<Page<Listing>>('tinir_read', 'saved_listings', page),
  set: (id: string, saved: boolean) => call<{ saved: boolean }>('tinir_write', 'save_listing', { id, saved }),
};
export const reminders = { list: (page: PageRequest = {}) => call<Page<Reminder>>('tinir_read', 'reminders', page) };
export const currentProfile = () => call<Profile>('tinir_read', 'profile');
