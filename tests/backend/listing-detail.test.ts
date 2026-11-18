import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localStatus } from '../../scripts/backend/local-status.mjs';

// FR6 / NFR8 direct-request checks for the listing details read. The UI is bypassed: these are the
// payloads any client receives. Accounts, listings and photo rows are synthetic and removed afterwards.
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const admin = createClient(url, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const OWNER_PHONE = '0917 555 0101';

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
  const email = `tinir-detail-${role}-${randomUUID()}@example.test`;
  const password = `Pw1-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { role, full_name: `Fictional ${role}`, contact_number: OWNER_PHONE },
  });
  if (error) throw error;
  users.push(data.user.id);
  const c = client();
  const login = await c.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { id: data.user.id, email, client: c };
}
async function detail(c: SupabaseClient, id: string): Promise<{ code: string; data?: Record<string, unknown> }> {
  const { data, error } = await c.rpc('tinir_read', { operation: 'listing', args: { id } });
  if (error) {
    try { return { code: (JSON.parse(error.message) as { code: string }).code }; }
    catch { return { code: `DB_${error.code}` }; }
  }
  return { code: 'OK', data: data as Record<string, unknown> };
}

let guest: SupabaseClient;
let student: Awaited<ReturnType<typeof member>>;
let owner: Awaited<ReturnType<typeof member>>;
let otherOwner: Awaited<ReturnType<typeof member>>;
const ids = { hidden: randomUUID(), visible: randomUUID(), draft: randomUUID(), archived: randomUUID() };

beforeAll(async () => {
  guest = client();
  [student, owner, otherOwner] = await Promise.all([member('student'), member('owner'), member('owner')]);
  sql(`INSERT INTO app_private.listings(id,owner_id,title,property_type,address,area,description,house_rules,latitude,longitude,
      price_amount,price_visible,price_period,available_slots,availability_status,status,last_confirmed_at) VALUES
    ('${ids.hidden}','${owner.id}','Detail hidden price','room','12 Synthetic St','Synthetic area','Synthetic description','No pets',10.64,122.23,
      410000,false,'monthly',2,'available','published',now()),
    ('${ids.visible}','${owner.id}','Detail visible price','apartment','34 Synthetic St','Synthetic area','','',10.64,122.23,
      650000,true,'semester',null,'full','published',now()),
    ('${ids.draft}','${owner.id}','Detail draft','room','56 Synthetic St','','','',10.64,122.23,300000,true,'monthly',null,'available','draft',null),
    ('${ids.archived}','${owner.id}','Detail archived','room','78 Synthetic St','','','',10.64,122.23,300000,true,'monthly',null,'available','archived',now());
    INSERT INTO app_private.listing_amenities SELECT '${ids.hidden}',id FROM app_private.amenities WHERE name IN ('Wi-Fi','Kitchen');
    INSERT INTO app_private.listing_photos(listing_id,storage_key,sort_order,state) VALUES
      ('${ids.hidden}','${ids.hidden}/${randomUUID()}.webp',1,'ready'),
      ('${ids.hidden}','${ids.hidden}/${randomUUID()}.webp',0,'ready'),
      ('${ids.hidden}','${ids.hidden}/${randomUUID()}.webp',2,'pending');`);
}, 60000);
afterAll(async () => {
  const list = users.map((id) => `'${id}'`).join(',');
  if (list) sql(`DELETE FROM app_private.listings WHERE owner_id IN (${list});
    DELETE FROM app_private.photo_cleanup WHERE listing_id IN ('${ids.hidden}');
    DELETE FROM app_private.request_limits WHERE actor_id IN (${list});`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}, 30000);

describe('listing details (FR6)', () => {
  it('returns every public detail field with ordered, finished photos only', async () => {
    const { code, data } = await detail(guest, ids.hidden);
    expect(code).toBe('OK');
    expect(data).toMatchObject({
      id: ids.hidden, title: 'Detail hidden price', property_type: 'room', address: '12 Synthetic St', area: 'Synthetic area',
      description: 'Synthetic description', house_rules: 'No pets', available_slots: 2, availability_status: 'available',
      price_visible: false, price_period: 'monthly', amenities: ['Kitchen', 'Wi-Fi'],
    });
    expect(data?.updated_at).toBeTruthy();
    expect(data?.last_confirmed_at).toBeTruthy();
    expect((data?.photos as { sort_order: number }[]).map((p) => p.sort_order)).toEqual([0, 1]);
    // Storage keys stay server-side; photos are fetched through the media function.
    expect(JSON.stringify(data)).not.toContain('.webp');
  });

  it('includes a disclosed price for everyone and omits a hidden one for every non-owner view', async () => {
    expect((await detail(guest, ids.visible)).data).toMatchObject({ price_visible: true, price_amount: 650000, price_period: 'semester' });
    for (const viewer of [guest, student.client, otherOwner.client, owner.client]) {
      const { data } = await detail(viewer, ids.hidden);
      expect(data).not.toHaveProperty('price_amount');
      expect(JSON.stringify(data)).not.toContain('410000');
    }
  });

  it('omits owner contacts for guests and shows them to logged-in users (NFR8)', async () => {
    const { data } = await detail(guest, ids.hidden);
    expect(data).not.toHaveProperty('owner_contact');
    expect(JSON.stringify(data)).not.toContain(owner.email);
    expect(JSON.stringify(data)).not.toContain(OWNER_PHONE);
    for (const viewer of [student.client, otherOwner.client]) {
      expect((await detail(viewer, ids.hidden)).data?.owner_contact)
        .toEqual({ full_name: 'Fictional owner', contact_number: OWNER_PHONE, email: owner.email });
    }
  });

  it('never exposes management fields in the public view', async () => {
    for (const viewer of [guest, student.client, owner.client]) {
      const { data } = await detail(viewer, ids.hidden);
      expect(data).not.toHaveProperty('owner_id');
      expect(data).not.toHaveProperty('status');
    }
  });

  it('reports drafts, archived, unknown, and malformed IDs as unavailable', async () => {
    for (const viewer of [guest, student.client, owner.client]) {
      expect((await detail(viewer, ids.draft)).code).toBe('NOT_FOUND');
      expect((await detail(viewer, ids.archived)).code).toBe('NOT_FOUND');
      expect((await detail(viewer, randomUUID())).code).toBe('NOT_FOUND');
    }
    expect((await detail(guest, 'not-a-uuid')).code).toBe('DB_22P02');
  });

  it('drops owner contacts for a logged-out token that has not expired yet', async () => {
    const leaving = await member('student');
    const token = (await leaving.client.auth.getSession()).data.session!.access_token;
    const replay = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    expect((await detail(replay, ids.hidden)).data).toHaveProperty('owner_contact');
    await leaving.client.auth.signOut();
    const after = await detail(replay, ids.hidden);
    expect(after.code).toBe('OK');
    expect(after.data).not.toHaveProperty('owner_contact');
  });
});
