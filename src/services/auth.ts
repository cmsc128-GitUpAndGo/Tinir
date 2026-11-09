import { z } from 'zod';
import { Platform } from 'react-native';
import { getSupabase } from '@/lib/supabase/client';
import { backendError, BackendError } from './errors';
import { loginError, signOutDevice, validateLogin, type LoginForm } from './login';
import { REGISTERED_MESSAGE, signupOutcome, validateRegistration, type RegistrationForm } from './registration';

export type { LoginForm } from './login';
export type { Registration, RegistrationForm } from './registration';

function redirectTo() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'tinir://auth/callback';
}
export async function register(input: RegistrationForm) {
  const checked = validateRegistration(input);
  if (!checked.ok) throw new BackendError('INVALID_INPUT', 'Check the highlighted fields.', checked.fields);
  const { email, password, ...data } = checked.value;
  const { error } = await getSupabase().auth.signUp({ email, password, options: { data, emailRedirectTo: redirectTo() } });
  const outcome = signupOutcome(error);
  if (!outcome.ok) throw outcome.error;
  // Duplicate addresses get the same result, so the form never discloses whether an account exists.
  return { message: REGISTERED_MESSAGE, delivery: outcome.delivery };
}
export async function login(input: LoginForm) {
  const checked = validateLogin(input);
  if (!checked.ok) throw new BackendError('INVALID_INPUT', 'Check the highlighted fields.', checked.fields);
  const { data, error } = await getSupabase().auth.signInWithPassword(checked.value);
  if (error) throw loginError(error);
  return data.session;
}
/**
 * Log out this device. The local session is removed before the network call, so logout never depends on
 * connectivity; Auth then deletes the server session, which makes protected RPCs reject the old token.
 */
/** Always signs this device out; `revoked` is false when the server could not confirm the session ended. */
export async function logout() {
  return signOutDevice(getSupabase().auth);
}
export async function resendVerification(email: string) {
  email = email.trim().toLowerCase();
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
