import { z } from 'zod';
import { Platform } from 'react-native';
import { getSupabase } from '@/lib/supabase/client';
import { backendError, BackendError } from './errors';

const registration = z.object({
  email: z.email().max(255), password: z.string().min(8).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/),
  role: z.enum(['student', 'owner']), full_name: z.string().trim().min(1).max(120),
  contact_number: z.string().trim().max(20).optional(), college_program: z.string().trim().max(120).optional(),
}).refine((v) => v.role !== 'owner' || Boolean(v.contact_number), { path: ['contact_number'], message: 'An owner contact number is required.' });
export type Registration = z.infer<typeof registration>;
function redirectTo() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'tinir://auth/callback';
}
export async function register(input: Registration) {
  const parsed = registration.safeParse(input);
  if (!parsed.success) throw new BackendError('INVALID_INPUT', 'Check the registration fields.', Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
  const { email, password, ...data } = parsed.data;
  const { error } = await getSupabase().auth.signUp({ email, password, options: { data, emailRedirectTo: redirectTo() } });
  if (error) throw backendError(error);
  // A generic result also covers duplicate addresses without disclosing account existence.
  return { message: 'Check your email to verify your account.' };
}
export async function login(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw backendError(error);
  return data.session;
}
export async function logout() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw backendError(error);
}
export async function resendVerification(email: string) {
  if (!z.email().safeParse(email).success) throw new BackendError('INVALID_INPUT', 'Enter a valid email address.');
  const { error } = await getSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo() } });
  if (error && error.code?.startsWith('over_')) throw backendError(error);
  return { message: 'If verification is needed, check your email.' };
}
export async function completeVerification(url: string) {
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  if (!code || parsed.searchParams.has('error')) throw new BackendError('INVALID_INPUT', 'This verification link is invalid or expired.');
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) throw backendError(error);
}
