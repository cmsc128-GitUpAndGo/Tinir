import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { localStatus } from '../../scripts/backend/local-status.mjs';
import { signupError } from '../../src/services/registration';

// FR3 end to end against local Auth and the captured-mail server. Every address is synthetic and removed afterwards.
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const mailpit: string = status.MAILPIT_URL ?? status.INBUCKET_URL;
const admin = createClient(url, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const redirect = 'http://127.0.0.1:8081/auth/callback';
const created = new Set<string>();

function browser(): SupabaseClient {
  const memory = new Map<string, string>();
  return createClient(url, key, {
    auth: {
      flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => { memory.delete(k); } },
    },
  });
}
const address = (label: string) => `tinir-reg-${label}-${randomUUID()}@example.test`;
const password = () => `Pw1-${randomUUID()}`;

async function signUp(client: SupabaseClient, email: string, data: Record<string, unknown>) {
  created.add(email);
  return client.auth.signUp({ email, password: password(), options: { data, emailRedirectTo: redirect } });
}
async function userByEmail(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email) ?? null;
}
async function mailsTo(email: string, count = 1): Promise<string[]> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    if ((search.messages?.length ?? 0) >= count) {
      return Promise.all(search.messages.map((m: { ID: string }) => fetch(`${mailpit}/api/v1/message/${m.ID}`).then((r) => r.json()).then((body) => body.Text as string)));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No verification email reached ${email}`);
}
function verifyLink(text: string) {
  const link = text.match(/https?:\/\/[^\s)\]]+\/auth\/v1\/verify\?[^\s)\]]+/)?.[0];
  if (!link) throw new Error('Verification link missing from email');
  return link.replace(/&amp;/g, '&');
}
async function follow(link: string) {
  const response = await fetch(link, { redirect: 'manual' });
  return new URL(response.headers.get('location') ?? '', url);
}

afterAll(async () => {
  for (const email of created) {
    const user = await userByEmail(email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
});

describe('registration and email verification (FR3)', () => {
  for (const role of ['student', 'owner'] as const) {
    it(`registers and verifies a ${role} with the matching profile`, async () => {
      const client = browser();
      const email = address(role);
      const metadata = role === 'owner'
        ? { role, full_name: 'Fictional Owner', contact_number: '0917 000 0000', college_program: 'Should be dropped' }
        : { role, full_name: 'Fictional Student', college_program: 'BS Computer Science' };
      const pw = password();
      created.add(email);
      const signup = await client.auth.signUp({ email, password: pw, options: { data: metadata, emailRedirectTo: redirect } });
      expect(signup.error).toBeNull();
      expect(signup.data.session).toBeNull(); // No session until the email is confirmed.

      // Unverified accounts cannot log in yet.
      const early = await browser().auth.signInWithPassword({ email, password: pw });
      expect(early.error?.code).toBe('email_not_confirmed');

      const link = verifyLink((await mailsTo(email))[0]);
      const callback = await follow(link);
      expect(callback.origin + callback.pathname).toBe(redirect);
      const code = callback.searchParams.get('code');
      expect(code).toBeTruthy();
      const exchanged = await client.auth.exchangeCodeForSession(code!);
      expect(exchanged.error).toBeNull();

      const { data: profile, error } = await client.rpc('tinir_read', { operation: 'profile', args: {} });
      expect(error).toBeNull();
      expect(profile).toMatchObject({ role, email, email_verified: true });
      expect(profile.college_program).toBe(role === 'student' ? 'BS Computer Science' : null);
      expect(JSON.stringify(profile)).not.toContain(pw);

      // A used link fails safely: no new session code is issued.
      const reused = await follow(link);
      expect(reused.searchParams.get('code')).toBeNull();
      expect(`${reused.search}${reused.hash}`).toMatch(/error/);
    });
  }

  it('enforces role rules on the server even when the form is bypassed', async () => {
    const cases: Record<string, unknown>[] = [
      { role: 'admin', full_name: 'Fictional Admin' },
      { full_name: 'Fictional No Role' },
      { role: 'owner', full_name: 'Fictional Owner' },
      { role: 'owner', full_name: 'Fictional Owner', contact_number: 'call me maybe' },
      { role: 'student', full_name: '   ' },
    ];
    for (const metadata of cases) {
      const email = address('invalid');
      const { error } = await signUp(browser(), email, metadata);
      expect(error, JSON.stringify(metadata)).not.toBeNull();
      expect(await userByEmail(email)).toBeNull();
    }
  });

  it('gives no hint that an email is already registered', async () => {
    const email = address('dup');
    const first = await signUp(browser(), email, { role: 'student', full_name: 'Fictional Student' });
    const second = await signUp(browser(), email, { role: 'owner', full_name: 'Fictional Owner', contact_number: '09170000000' });
    expect(first.error).toBeNull();
    // Auth may throttle the repeat; the app must still report the same generic success.
    expect(second.error ? signupError(second.error) : null).toBeNull();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(data.users.filter((user) => user.email === email)).toHaveLength(1);
    // The original role is kept; the duplicate cannot switch it.
    const user = data.users.find((u) => u.email === email)!;
    expect(user.user_metadata.role).toBe('student');
  });

  it('rate-limits resend and does not disclose unknown addresses', async () => {
    const client = browser();
    const unknown = await client.auth.resend({ type: 'signup', email: address('unknown'), options: { emailRedirectTo: redirect } });
    expect(unknown.error?.code ?? null).not.toBe('user_not_found');

    const email = address('resend');
    await signUp(client, email, { role: 'student', full_name: 'Fictional Student' });
    await mailsTo(email);
    const again = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } });
    expect(again.error?.code).toMatch(/^over_/);
  });
});
