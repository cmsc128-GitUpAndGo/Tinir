import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localStatus } from '../../scripts/backend/local-status.mjs';

// Inquiry requests made directly against the database gateway, bypassing every client check (FR2, FR7, FR8).
// Accounts and listings are synthetic and removed afterwards.
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
  const email = `tinir-inquiry-${role}-${randomUUID()}@example.test`;
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
const inquiriesOf = (studentId: string) => Number(sql(`SELECT count(*) FROM app_private.inquiries WHERE student_id='${studentId}'`));

let guest: SupabaseClient;
let owner: Awaited<ReturnType<typeof member>>;
const listingId = randomUUID();

beforeAll(async () => {
  guest = client();
  owner = await member('owner');
  sql(`INSERT INTO app_private.listings(id,owner_id,title,property_type,address,latitude,longitude,status) VALUES
    ('${listingId}','${owner.id}','Inquiry fixture','room','Synthetic address',10.7,122.5,'published')`);
}, 60000);
afterAll(async () => {
  const list = users.map((id) => `'${id}'`).join(',');
  if (list) sql(`DELETE FROM app_private.inquiries WHERE student_id IN (${list}) OR listing_id IN (SELECT id FROM app_private.listings WHERE owner_id IN (${list}));
    DELETE FROM app_private.request_limits WHERE actor_id IN (${list});
    DELETE FROM app_private.listings WHERE owner_id IN (${list});`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}, 30000);

describe('who may send an inquiry (FR2)', () => {
  it('rejects both entry points from a guest before any inquiry exists', async () => {
    const before = Number(sql(`SELECT count(*) FROM app_private.inquiries WHERE listing_id='${listingId}'`));
    expect((await call(guest, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' })).code).toBe('NO_EXECUTE');
    expect((await call(guest, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message: 'Is water included?' })).code).toBe('NO_EXECUTE');
    expect(Number(sql(`SELECT count(*) FROM app_private.inquiries WHERE listing_id='${listingId}'`))).toBe(before);
  });

  it('tells an unverified student to verify, for both entry points', async () => {
    const pending = await member('student');
    sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${pending.id}'`);
    expect((await call(pending.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' })).code).toBe('EMAIL_UNVERIFIED');
    expect((await call(pending.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message: 'Hello?' })).code).toBe('EMAIL_UNVERIFIED');
    expect(inquiriesOf(pending.id)).toBe(0);
  });

  it('refuses owners, including on their own listing', async () => {
    expect((await call(owner.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' })).code).toBe('FORBIDDEN');
    expect(Number(sql(`SELECT count(*) FROM app_private.inquiries WHERE listing_id='${listingId}'`))).toBe(0);
  });

  it('rejects a logged-out token that has not expired yet', async () => {
    const leaving = await member('student');
    const token = (await leaving.client.auth.getSession()).data.session!.access_token;
    await leaving.client.auth.signOut();
    const replay = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    expect((await call(replay, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' })).code).toBe('UNAUTHENTICATED');
    expect(inquiriesOf(leaving.id)).toBe(0);
  });
});

describe('sending an inquiry (FR7)', () => {
  it('records a question as Pending for the listing and student, visible only to the owning owner', async () => {
    const student = await member('student');
    const otherOwner = await member('owner');
    const sent = await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message: 'Is water included?' });
    expect(sent.code).toBe('OK');
    const id = (sent.data as { id: string }).id;
    expect(sql(`SELECT listing_id||'|'||student_id||'|'||type||'|'||status FROM app_private.inquiries WHERE id='${id}'`))
      .toBe(`${listingId}|${student.id}|question|pending`);

    const received = await call(owner.client, 'tinir_read', 'owner_inquiries');
    expect((received.data as { items: { id: string; message: string }[] }).items).toContainEqual(expect.objectContaining({ id, message: 'Is water included?' }));
    expect((await call(otherOwner.client, 'tinir_read', 'owner_inquiries')).data).toMatchObject({ items: [] });
  });

  it('keeps one Pending interest per student and listing however often it is sent', async () => {
    const student = await member('student');
    const sends = await Promise.all(Array.from({ length: 3 }, () =>
      call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' })));
    expect(sends.every((s) => s.code === 'OK')).toBe(true);
    expect(new Set(sends.map((s) => (s.data as { id: string }).id)).size).toBe(1);
    expect(inquiriesOf(student.id)).toBe(1);
  });

  it('rejects empty and oversized questions and unknown inquiry types without recording them', async () => {
    const student = await member('student');
    for (const args of [
      { listing_id: listingId, type: 'question' },
      { listing_id: listingId, type: 'question', message: '   ' },
      { listing_id: listingId, type: 'question', message: '\n\t \r\n\n' },
      { listing_id: listingId, type: 'question', message: '\u000b\f\n' },
      { listing_id: listingId, type: 'question', message: 'x'.repeat(4001) },
      { listing_id: listingId, type: 'booking', message: 'Reserve it' },
    ]) {
      expect((await call(student.client, 'tinir_write', 'send_inquiry', args)).code, JSON.stringify(args).slice(0, 60)).toBe('INVALID_INPUT');
    }
    expect(inquiriesOf(student.id)).toBe(0);
  });

  it('rejects inquiries on drafts, archived, and unknown listings', async () => {
    const student = await member('student');
    const [draft, archived] = [randomUUID(), randomUUID()];
    sql(`INSERT INTO app_private.listings(id,owner_id,title,property_type,address,latitude,longitude,status) VALUES
      ('${draft}','${owner.id}','Inquiry draft','room','Synthetic address',10.7,122.5,'draft'),
      ('${archived}','${owner.id}','Inquiry archived','room','Synthetic address',10.7,122.5,'archived')`);
    for (const id of [draft, archived, randomUUID()]) {
      expect((await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: id, type: 'interest' })).code).toBe('NOT_FOUND');
    }
    expect(inquiriesOf(student.id)).toBe(0);
  });

  it('cannot be sent in another student’s name', async () => {
    const student = await member('student');
    const victim = await member('student');
    const forged = await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest', student_id: victim.id });
    expect(forged.code).toBe('INVALID_INPUT');
    expect(inquiriesOf(victim.id)).toBe(0);
  });
});

describe('tracking sent inquiries (FR8)', () => {
  type Sent = { items: { id: string; listing_id: string; listing_title: string; status: string; read_at: string | null }[] };
  const sentBy = async (c: SupabaseClient, args: object = {}) => (await call(c, 'tinir_read', 'student_inquiries', args)).data as Sent;

  it('lists only the current student\u2019s inquiries, newest first, with listing context', async () => {
    const student = await member('student');
    const other = await member('student');
    const first = await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message: 'First' });
    const second = await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message: 'Second' });
    await call(other.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' });
    const { items } = await sentBy(student.client);
    expect(items.map((i) => i.id)).toEqual([(second.data as { id: string }).id, (first.data as { id: string }).id]);
    expect(items.every((i) => i.listing_id === listingId && i.listing_title === 'Inquiry fixture' && i.status === 'pending')).toBe(true);
  });

  it('shows the owner\u2019s stored decision on the next fetch, and reading never decides', async () => {
    const student = await member('student');
    const sent = await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'interest' });
    const id = (sent.data as { id: string }).id;
    expect((await call(owner.client, 'tinir_write', 'update_inquiry', { id, mark_read: true })).code).toBe('OK');
    expect((await sentBy(student.client)).items[0]).toMatchObject({ id, status: 'pending' });
    expect((await call(owner.client, 'tinir_write', 'update_inquiry', { id, status: 'accepted' })).code).toBe('OK');
    expect((await sentBy(student.client)).items[0]).toMatchObject({ id, status: 'accepted' });
    expect((await call(owner.client, 'tinir_write', 'update_inquiry', { id, status: 'pending' })).code).toBe('OK');
    expect((await call(owner.client, 'tinir_write', 'update_inquiry', { id, status: 'rejected' })).code).toBe('OK');
    expect((await sentBy(student.client)).items[0]).toMatchObject({ id, status: 'rejected' });
  });

  it('pages through the student\u2019s records', async () => {
    const student = await member('student');
    for (const message of ['One', 'Two', 'Three']) {
      expect((await call(student.client, 'tinir_write', 'send_inquiry', { listing_id: listingId, type: 'question', message })).code).toBe('OK');
    }
    const page1 = await sentBy(student.client, { page: 1, page_size: 2 });
    const page2 = await sentBy(student.client, { page: 2, page_size: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(1);
    expect(new Set([...page1.items, ...page2.items].map((i) => i.id)).size).toBe(3);
  });
});
