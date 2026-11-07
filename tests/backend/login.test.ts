import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localStatus } from '../../scripts/backend/local-status.mjs';
import { loginError } from '../../src/services/login';

// FR4 end to end against local Auth, the RPC gateway and the media function. Accounts are synthetic and removed afterwards.
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const admin = createClient(url, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];

function device(): SupabaseClient {
  const memory = new Map<string, string>();
  return createClient(url, key, {
    auth: {
      persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => { memory.delete(k); } },
    },
  });
}
/** A client that replays a captured access token, as an attacker holding an old token would. */
function withToken(token: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}
async function account(role: 'student' | 'owner', confirmed = true) {
  const email = `tinir-login-${role}-${randomUUID()}@example.test`;
  const password = `Pw1-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: confirmed,
    user_metadata: { role, full_name: `Fictional ${role}`, contact_number: '0917 000 0000' },
  });
  if (error) throw error;
  users.push(data.user.id);
  return { email, password, id: data.user.id };
}
async function profileCode(client: SupabaseClient) {
  const { data, error } = await client.rpc('tinir_read', { operation: 'profile' });
  if (error) return (JSON.parse(error.message) as { code: string }).code;
  return (data as { error?: { code: string } }).error?.code ?? 'OK';
}
async function mediaStatus(token: string) {
  const response = await fetch(`${url}/functions/v1/media`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'read', id: randomUUID() }),
  });
  return response.status;
}

let student: Awaited<ReturnType<typeof account>>;
let owner: Awaited<ReturnType<typeof account>>;
let listingId: string;
function sql(query: string) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
beforeAll(async () => {
  [student, owner] = await Promise.all([account('student'), account('owner')]);
  // A published listing whose detail carries the owner contact that logout must hide again.
  listingId = randomUUID();
  sql(`INSERT INTO app_private.listings(id,owner_id,title,property_type,address,latitude,longitude,status)
    VALUES ('${listingId}','${owner.id}','Login fixture','room','Synthetic address',10.7,122.5,'published')`);
});
afterAll(async () => {
  const ids = users.map((id) => `'${id}'`).join(',');
  if (ids) sql(`DELETE FROM app_private.saved_listings WHERE student_id IN (${ids}); DELETE FROM app_private.request_limits WHERE actor_id IN (${ids}); DELETE FROM app_private.listings WHERE owner_id IN (${ids});`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}, 30000);

describe('log in (FR4)', () => {
  it('starts a session that reaches the user\'s own profile and role', async () => {
    const client = device();
    const { data, error } = await client.auth.signInWithPassword(student);
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    const profile = await client.rpc('tinir_read', { operation: 'profile' });
    expect(profile.data).toMatchObject({ id: student.id, role: 'student', email_verified: true });
  });

  it('gives a wrong password and an unknown address the same generic error', async () => {
    const wrong = await device().auth.signInWithPassword({ email: student.email, password: 'Wrong-pass-1' });
    const unknown = await device().auth.signInWithPassword({ email: `nobody-${randomUUID()}@example.test`, password: 'Wrong-pass-1' });
    expect(wrong.error?.code).toBe(unknown.error?.code);
    expect(wrong.error?.status).toBe(unknown.error?.status);
    expect(loginError(wrong.error).error).toEqual(loginError(unknown.error).error);
    expect(loginError(wrong.error).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('only reveals an unverified address to someone who knows its password', async () => {
    const pending = await account('student', false);
    const guess = await device().auth.signInWithPassword({ email: pending.email, password: 'Wrong-pass-1' });
    expect(loginError(guess.error).error.code).toBe('INVALID_CREDENTIALS');
    const holder = device();
    const real = await holder.auth.signInWithPassword(pending);
    expect(loginError(real.error).error.code).toBe('EMAIL_UNVERIFIED');
    expect((await holder.auth.getSession()).data.session).toBeNull();
  });
});

describe('log out (FR4)', () => {
  it('clears the device and makes the old tokens useless on the server', async () => {
    const client = device();
    const { data } = await client.auth.signInWithPassword(student);
    const { access_token: access, refresh_token: refresh } = data.session!;
    const replay = withToken(access);
    expect(await profileCode(replay)).toBe('OK');
    const before = await replay.rpc('tinir_read', { operation: 'listing', args: { id: listingId } });
    expect(before.data).toHaveProperty('owner_contact');
    expect(await mediaStatus(access)).toBe(404);

    expect((await client.auth.signOut({ scope: 'local' })).error).toBeNull();
    expect((await client.auth.getSession()).data.session).toBeNull();

    expect(await profileCode(replay)).toBe('UNAUTHENTICATED');
    const write = await replay.rpc('tinir_write', { operation: 'save_listing', args: { listing_id: listingId } });
    expect(write.error ? JSON.parse(write.error.message).code : (write.data as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    const after = await replay.rpc('tinir_read', { operation: 'listing', args: { id: listingId } });
    expect(after.data).not.toHaveProperty('owner_contact');
    expect(after.data).toMatchObject({ id: listingId });
    expect(await mediaStatus(access)).toBe(401);
    const refreshed = await device().auth.refreshSession({ refresh_token: refresh });
    expect(refreshed.error).not.toBeNull();
  });

  it('leaves the same user\'s other devices logged in', async () => {
    const phone = device();
    const laptop = device();
    await phone.auth.signInWithPassword(student);
    await laptop.auth.signInWithPassword(student);
    await phone.auth.signOut({ scope: 'local' });
    expect(await profileCode(laptop)).toBe('OK');
    await laptop.auth.signOut({ scope: 'local' });
  });
});
