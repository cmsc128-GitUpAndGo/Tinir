import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ImageMagick, initializeImageMagick, MagickColors, MagickFormat } from '@imagemagick/magick-wasm';
import { localStatus } from '../../scripts/backend/local-status.mjs';

const shared = vi.hoisted(() => ({ client: undefined as unknown as SupabaseClient }));
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => shared.client }));
import { listings } from '../../src/services/backend';
import type { ListingInput } from '../../src/services/contracts';
import type { PickedPhoto } from '../../src/services/listing-form';
import { initialProgress, publishListing, type PublishApi } from '../../src/services/listing-publish';
import { media } from '../../src/services/media';

// FR9 end to end: the app's own publish flow against local Auth, the RPC gateway and the media function.
// Accounts and listings are synthetic and removed afterwards.
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const admin = createClient(url, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
let owner: SupabaseClient, otherOwner: SupabaseClient, student: SupabaseClient, unverifiedOwner: SupabaseClient;
let png: Uint8Array;
const ids = new Map<SupabaseClient, string>();

function sql(query: string) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
async function member(role: 'owner' | 'student', confirmed = true) {
  const email = `tinir-create-${role}-${randomUUID()}@example.test`;
  const password = `Pw1-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: confirmed, user_metadata: { role, full_name: `Fictional ${role}`, contact_number: '0917 555 0199' },
  });
  if (error) throw error;
  users.push(data.user.id);
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (confirmed) {
    const login = await c.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
  } else {
    // An unverified owner still holds a session token from a password grant, but the database refuses it.
    sql(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${data.user.id}'`);
    const login = await c.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    sql(`UPDATE auth.users SET email_confirmed_at=null WHERE id='${data.user.id}'`);
  }
  ids.set(c, data.user.id);
  return c;
}
const as = (c: SupabaseClient) => { shared.client = c; };
const photo = (key: string, bytes: Uint8Array = png, type = 'image/png'): PickedPhoto & { file: Blob } =>
  ({ key, uri: '', name: `${key}.png`, type, size: bytes.length, file: new Blob([new Uint8Array(bytes)], { type }) });
const api: PublishApi = {
  create: listings.create, update: listings.update, publish: listings.publish, removePhoto: media.remove,
  upload: (id, p) => media.upload(id, p.file!),
};
const base: ListingInput = {
  title: 'Fictional FR9 room', property_type: 'room', address: '9 Synthetic St, Miagao', area: 'Synthetic area',
  description: 'Synthetic description', house_rules: 'No pets', latitude: 10.6435, longitude: 122.2285,
  price_visible: false, price_amount: null, price_period: 'monthly', available_slots: 2, availability_status: 'available',
};
async function readAs(c: SupabaseClient, operation: string, args: object) {
  const { data, error } = await c.rpc('tinir_read', { operation, args });
  if (error) return { code: (() => { try { return (JSON.parse(error.message) as { code: string }).code; } catch { return error.code; } })() };
  return { code: 'OK', data: data as Record<string, unknown> };
}

beforeAll(async () => {
  [owner, otherOwner, student, unverifiedOwner] = await Promise.all([member('owner'), member('owner'), member('student'), member('owner', false)]);
  const require = createRequire(import.meta.url);
  await initializeImageMagick(new Uint8Array(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm'))));
  png = ImageMagick.read(MagickColors.Green, 120, 80, (image) => image.write(MagickFormat.Png, (bytes) => new Uint8Array(bytes)));
}, 90000);
afterAll(async () => {
  const list = users.map((id) => `'${id}'`).join(',');
  if (list) sql(`DELETE FROM app_private.listings WHERE owner_id IN (${list}); DELETE FROM app_private.request_limits WHERE actor_id IN (${list});`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}, 60000);

describe('creating a listing (FR9)', () => {
  it('publishes a hidden-price listing with photos that guests can browse without the amount', async () => {
    as(owner);
    const amenities = await listings.amenities();
    const input = { ...base, price_amount: 350000, amenity_ids: amenities.slice(0, 2).map((a) => a.id) };
    const result = await publishListing(input, [photo('cover'), photo('second')], initialProgress, api);
    expect(result.status).toBe('published');
    if (result.status !== 'published') return;
    expect(result.listing).toMatchObject({ status: 'published', price_amount: 350000, price_visible: false });
    expect(result.listing.photos).toHaveLength(2);
    expect(sql(`SELECT owner_id FROM app_private.listings WHERE id='${result.listing.id}'`)).toBe(ids.get(owner));

    const guest = anon();
    const detail = await readAs(guest, 'listing', { id: result.listing.id });
    expect(detail.code).toBe('OK');
    expect(detail.data).toMatchObject({ title: base.title, price_visible: false, latitude: 10.6435, longitude: 122.2285 });
    expect(detail.data).not.toHaveProperty('price_amount');
    expect(detail.data).not.toHaveProperty('owner_contact');
    expect((detail.data!.amenities as string[]).sort()).toEqual(amenities.slice(0, 2).map((a) => a.name).sort());
    const feed = await readAs(guest, 'listings', { q: 'Fictional FR9 room', page_size: 50 });
    expect((feed.data!.items as { id: string }[]).map((l) => l.id)).toContain(result.listing.id);
  });

  it('publishes a hidden price with no amount, and rejects a shown price without one', async () => {
    as(owner);
    expect((await publishListing({ ...base, title: 'Fictional no-price room' }, [photo('a')], initialProgress, api)).status).toBe('published');
    const bad = await publishListing({ ...base, price_visible: true, price_amount: null }, [photo('a')], initialProgress, api);
    expect(bad).toMatchObject({ status: 'failed', stage: 'save', progress: { draftId: null } });
    await expect(listings.create({ ...base, price_visible: true, price_amount: 0 })).rejects.toMatchObject({ error: { code: 'INVALID_INPUT' } });
  });

  it('keeps a listing as a draft when a photo is rejected, then publishes on retry', async () => {
    as(owner);
    const notImage = new TextEncoder().encode('not an image');
    const first = await publishListing({ ...base, title: 'Fictional retry room' }, [photo('good'), photo('bad', notImage)], initialProgress, api);
    expect(first).toMatchObject({ status: 'failed', stage: 'photos', photoErrors: { bad: expect.stringMatching(/JPEG, PNG, or WebP/) } });
    if (first.status !== 'failed') return;
    const draftId = first.progress.draftId!;
    expect(sql(`SELECT status FROM app_private.listings WHERE id='${draftId}'`)).toBe('draft');
    expect(sql(`SELECT count(*) FROM app_private.listing_photos WHERE listing_id='${draftId}'`)).toBe('1');
    expect((await readAs(anon(), 'listing', { id: draftId })).code).toBe('NOT_FOUND');

    // The owner drops the bad photo; the good one is not uploaded twice.
    const retry = await publishListing({ ...base, title: 'Fictional retry room' }, [photo('good')], first.progress, api);
    expect(retry).toMatchObject({ status: 'published', listing: { id: draftId } });
    expect(sql(`SELECT count(*) FROM app_private.listing_photos WHERE listing_id='${draftId}'`)).toBe('1');
  });

  it('rejects oversized and mislabelled photos on the server', async () => {
    as(owner);
    const draft = await listings.create({ ...base, title: 'Fictional upload checks' });
    await expect(media.upload(draft.id, new Blob([new Uint8Array(png)], { type: 'image/jpeg' }))).rejects.toMatchObject({ error: { code: 'INVALID_INPUT' } });
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    await expect(media.upload(draft.id, new Blob([big], { type: 'image/png' }))).rejects.toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(sql(`SELECT count(*) FROM app_private.listing_photos WHERE listing_id='${draft.id}'`)).toBe('0');
  });

  it('denies students, unverified owners, and other owners', async () => {
    as(student);
    await expect(listings.create(base)).rejects.toMatchObject({ error: { code: 'FORBIDDEN' } });
    as(unverifiedOwner);
    await expect(listings.create(base)).rejects.toMatchObject({ error: { code: 'EMAIL_UNVERIFIED' } });

    as(owner);
    const draft = await listings.create({ ...base, title: 'Fictional owned draft' });
    as(otherOwner);
    await expect(media.upload(draft.id, new Blob([new Uint8Array(png)], { type: 'image/png' }))).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    await expect(listings.update(draft.id, { ...base, title: 'Taken over' })).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    await expect(listings.publish(draft.id)).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    // Forged identity fields are refused rather than ignored.
    await expect(listings.create({ ...base, owner_id: ids.get(owner) } as ListingInput)).rejects.toMatchObject({ error: { code: 'INVALID_INPUT' } });
  });
});
