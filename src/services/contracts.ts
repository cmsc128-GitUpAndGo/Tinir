export type Role = 'student' | 'owner';
export type PropertyType = 'bedspace' | 'room' | 'apartment';
export type Decision = 'pending' | 'accepted' | 'rejected';
export interface PageRequest { page?: number; page_size?: number }
export interface Page<T> { items: T[]; page: number; page_size: number }
export interface ListingFilters extends PageRequest { type?: PropertyType; min_price?: number; max_price?: number; amenities?: string[]; q?: string }
export interface Photo { id: string; sort_order: number }
export interface Listing {
  id: string; title: string; property_type: PropertyType; area: string; price_visible: boolean;
  price_amount?: number | null; price_period: 'monthly' | 'semester'; availability_status: 'available' | 'full';
  photos: Photo[]; amenities: string[]; created_at: string; updated_at: string;
}
export interface ListingDetail extends Listing {
  address: string; description: string; house_rules: string; latitude: number | null; longitude: number | null;
  available_slots: number | null; last_confirmed_at: string | null;
  owner_contact?: { full_name: string; contact_number: string | null; email: string };
}
export interface ManagedListing extends ListingDetail { owner_id: string; status: 'draft' | 'published' | 'archived' }
export interface ListingInput {
  title: string; property_type: PropertyType; address: string; description?: string; area?: string; house_rules?: string;
  latitude?: number | null; longitude?: number | null; price_amount?: number | null; price_visible?: boolean;
  price_period?: 'monthly' | 'semester'; available_slots?: number | null; availability_status?: 'available' | 'full'; amenity_ids?: string[];
}
export interface Profile { id: string; role: Role; full_name: string; contact_number: string | null; college_program: string | null; email: string; email_verified: boolean }
export interface Inquiry { id: string; listing_id: string; student_id: string; type: 'interest' | 'question'; message: string | null; status: Decision; read_at: string | null; created_at: string; status_updated_at: string; listing_title?: string }
export interface Campus { id: string; name: string; latitude: number; longitude: number }
export interface Reminder { listing_id: string; semester_id: string; title: string; created_at: string; dismissed_at: string | null }
export interface Distance { campus_id?: string; distance_km: number | null; method: 'straight_line'; reason?: 'CAMPUS_NOT_CONFIGURED' }
export interface BackendErrorShape { error: { code: string; message: string; fields?: Record<string, string> } }
