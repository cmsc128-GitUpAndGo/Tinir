import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localStatus } from '../../scripts/backend/local-status.mjs';

// FR5 direct-request checks: each role's allowed path and the denied paths for guests, wrong roles,
// other users and unverified accounts. The client UI is bypassed entirely. Accounts are synthetic.
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const admin = createClient(url, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];

function sql(query: string) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function client(): SupabaseClient {
  const memory = new Map<string, string>();
  return createClient(url, key, {
    auth: {
      persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => { memory.delete(k); } },
    },
  });
}
async function member(role: 'student' | 'owner') {
  const email = `tinir-role-${role}-${randomUUID()}@example.test`;
  const password = `Pw1-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { role, full_name: `Fictional ${role}`, contact_number: '0917 000 0000' },
  });
  if (error) throw error;
  users.push(data.user.id);
  const c = client();
  const login = await c.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { id: data.user.id, client: c };
}
type Result = { code: string; data?: unknown };
async function call(c: SupabaseClient, method: 'tinir_read' | 'tinir_write', operation: string, args: object = {}): Promise<Result> {
  const { data, error } = await c.rpc(method, { operation, args });
  if (error) {
    try { return { code: (JSON.parse(error.message) as { code: string }).code }; }
    catch { return { code: error.code === '42501' ? 'NO_EXECUTE' : `DB_${error.code}` }; }
  }
  const failure = (data as { error?: { code: string } } | null)?.error;
  return failure ? { code: failure.code } : { code: 'OK', data };
}
const ids = (result: Result) => ((result.data as { items: { id: string }[] }).items).map((item) => item.id);

let guest: SupabaseClient;
let student: Awaited<ReturnType<typeof member>>;
let otherStudent: Awaited<ReturnType<typeof member>>;
let owner: Awaited<ReturnType<typeof member>>;
let otherOwner: Awaited<ReturnType<typeof member>>;
let listingId: string;
let draftId: string;
let otherListingId: string;
let inquiryId: string;

beforeAll(async () => {
  guest = client();
  [student, otherStudent, owner, otherOwner] = await Promise.all([member('student'), member('student'), member('owner'), member('owner')]);
  [listingId, draftId, otherListingId] = [randomUUID(), randomUUID(), randomUUID()];
  sql(`INSERT INTO app_private.listings(id,owner_id,title,property_type,address,latitude,longitude,status) VALUES
    ('${listingId}','${owner.id}','Role fixture','room','Synthetic address',10.7,122.5,'published'),
    ('${draftId}','${owner.id}','Role draft','room','Synthetic address',10.7,122.5,'draft'),
    ('${otherListingId}','${otherOwner.id}','Other owner fixture','room','Synthetic address',10.7,122.5,'published')`);
  const sent = await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message: 'Is water included?' });
  expect(sent.code).toBe('OK');
  inquiryId = (sent.data as { id: string }).id;
  expect((await call(student.client, 'tinir_write', 'save_listing', { id: listingId, saved: true })).code).toBe('OK');
});
afterAll(async () => {
  const list = users.map((id) => `'${id}'`).join(',');
  if (list) sql(`DELETE FROM app_private.inquiries WHERE student_id IN (${list}) OR listing_id IN (SELECT id FROM app_private.listings WHERE owner_id IN (${list}));
    DELETE FROM app_private.saved_listings WHERE student_id IN (${list});
    DELETE FROM app_private.request_limits WHERE actor_id IN (${list});
    DELETE FROM app_private.listings WHERE owner_id IN (${list});`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}, 30000);

describe('guest (FR5)', () => {
  it('can browse public listings without owner contacts', async () => {
    expect((await call(guest, 'tinir_read', 'listings')).code).toBe('OK');
    const detail = await call(guest, 'tinir_read', 'listing', { id: listingId });
    expect(detail.code).toBe('OK');
    expect(detail.data).not.toHaveProperty('owner_contact');
  });
  it('is denied every private read', async () => {
    for (const operation of ['profile', 'saved_listings', 'student_inquiries', 'owner_inquiries', 'owner_listings']) {
      expect((await call(guest, 'tinir_read', operation)).code, operation).toBe('UNAUTHENTICATED');
    }
  });
  it('cannot call the write gateway at all', async () => {
    expect((await call(guest, 'tinir_write', 'save_listing', { id: listingId, saved: true })).code).toBe('NO_EXECUTE');
    expect((await call(guest, 'tinir_write', 'create_listing', { title: 'x', property_type: 'room', address: 'x' })).code).toBe('NO_EXECUTE');
  });
});

describe('student (FR5)', () => {
  it('reads only their own saved listings and inquiries', async () => {
    expect(ids(await call(student.client, 'tinir_read', 'saved_listings'))).toEqual([listingId]);
    expect(ids(await call(student.client, 'tinir_read', 'student_inquiries'))).toEqual([inquiryId]);
    expect(ids(await call(otherStudent.client, 'tinir_read', 'saved_listings'))).toEqual([]);
    expect(ids(await call(otherStudent.client, 'tinir_read', 'student_inquiries'))).toEqual([]);
  });
  it('sees owner contacts once logged in', async () => {
    expect((await call(student.client, 'tinir_read', 'listing', { id: listingId })).data).toHaveProperty('owner_contact');
  });
  it('is denied owner reads and writes', async () => {
    expect((await call(student.client, 'tinir_read', 'owner_listings')).code).toBe('FORBIDDEN');
    expect((await call(student.client, 'tinir_read', 'owner_inquiries')).code).toBe('FORBIDDEN');
    expect((await call(student.client, 'tinir_write', 'create_listing', { title: 'x', property_type: 'room', address: 'x' })).code).toBe('FORBIDDEN');
    expect((await call(student.client, 'tinir_write', 'update_inquiry', { id: inquiryId, status: 'accepted' })).code).toBe('FORBIDDEN');
  });
});

describe('property owner (FR5)', () => {
  it('reads only their own listings, drafts included', async () => {
    expect(ids(await call(owner.client, 'tinir_read', 'owner_listings')).sort()).toEqual([listingId, draftId].sort());
    expect(ids(await call(otherOwner.client, 'tinir_read', 'owner_listings'))).toEqual([otherListingId]);
  });
  it('reads only inquiries on their own listings', async () => {
    expect(ids(await call(owner.client, 'tinir_read', 'owner_inquiries'))).toEqual([inquiryId]);
    expect(ids(await call(otherOwner.client, 'tinir_read', 'owner_inquiries'))).toEqual([]);
  });
  it('cannot change another owner\'s listing or inquiry', async () => {
    expect((await call(otherOwner.client, 'tinir_write', 'update_listing', { id: listingId, title: 'Taken over' })).code).not.toBe('OK');
    expect((await call(otherOwner.client, 'tinir_write', 'archive_listing', { id: listingId })).code).not.toBe('OK');
    expect((await call(otherOwner.client, 'tinir_write', 'update_inquiry', { id: inquiryId, status: 'rejected' })).code).not.toBe('OK');
    expect(sql(`SELECT title||'|'||status FROM app_private.listings WHERE id='${listingId}'`)).toBe('Role fixture|published');
    expect(sql(`SELECT status FROM app_private.inquiries WHERE id='${inquiryId}'`)).toBe('pending');
  });
  it('can decide inquiries on their own listing', async () => {
    expect((await call(owner.client, 'tinir_write', 'update_inquiry', { id: inquiryId, mark_read: true })).code).toBe('OK');
  });
  it('is denied student reads and writes', async () => {
    expect((await call(owner.client, 'tinir_read', 'saved_listings')).code).toBe('FORBIDDEN');
    expect((await call(owner.client, 'tinir_read', 'student_inquiries')).code).toBe('FORBIDDEN');
    expect((await call(owner.client, 'tinir_write', 'save_listing', { id: otherListingId, saved: true })).code).toBe('FORBIDDEN');
    expect((await call(owner.client, 'tinir_write', 'send_inquiry', { listing_id: otherListingId, type: 'question' })).code).toBe('FORBIDDEN');
  });
  it('cannot claim another role through sign-up metadata', async () => {
    await owner.client.auth.updateUser({ data: { role: 'student' } });
    expect((await call(owner.client, 'tinir_read', 'profile')).data).toMatchObject({ role: 'owner' });
    expect((await call(owner.client, 'tinir_read', 'saved_listings')).code).toBe('FORBIDDEN');
  });
});

describe('unverified account (FR5 / PRD §5)', () => {
  it('keeps browsing and its profile but loses role actions', async () => {
    const pending = await member('student');
    sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${pending.id}'`);
    expect((await call(pending.client, 'tinir_read', 'listings')).code).toBe('OK');
    expect((await call(pending.client, 'tinir_read', 'profile')).data).toMatchObject({ email_verified: false });
    expect((await call(pending.client, 'tinir_read', 'saved_listings')).code).toBe('EMAIL_UNVERIFIED');
    expect((await call(pending.client, 'tinir_write', 'save_listing', { id: listingId, saved: true })).code).toBe('EMAIL_UNVERIFIED');
  });
});
