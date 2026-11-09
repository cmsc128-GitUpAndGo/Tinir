import { z } from 'zod';

import { BackendError, backendError } from './errors';

/** FR4 login form. Only presence and email shape are checked here; Auth checks the password. */
export interface LoginForm { email: string; password: string }
export type LoginFields = Partial<Record<keyof LoginForm, string>>;

export const INVALID_LOGIN = 'Email or password is incorrect.';

export function validateLogin(input: LoginForm): { ok: true; value: LoginForm } | { ok: false; fields: LoginFields } {
  const email = input.email.trim().toLowerCase();
  const fields: LoginFields = {};
  if (!email) fields.email = 'Enter your email.';
  else if (!z.email().safeParse(email).success) fields.email = 'Enter a valid email address.';
  // Passwords are compared exactly as typed, so they are never trimmed.
  if (!input.password) fields.password = 'Enter your password.';
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value: { email, password: input.password } };
}

/**
 * Map Auth login failures to user-facing errors. Wrong passwords and unknown addresses share one message,
 * so the form never reveals whether an account exists. Auth reports an unverified address only after the
 * password matches, so that message is shown to the account holder alone.
 */
export function loginError(error: unknown): BackendError {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'invalid_credentials' || code === 'user_not_found' || code === 'validation_failed') {
    return new BackendError('INVALID_CREDENTIALS', INVALID_LOGIN);
  }
  if (code === 'email_not_confirmed') {
    return new BackendError('EMAIL_UNVERIFIED', 'Verify your email before logging in. Open the link we sent, or resend it below.');
  }
  if (code?.startsWith('over_')) return new BackendError('RATE_LIMITED', 'Too many login attempts. Wait a minute and try again.');
  return backendError(error);
}

export const LOGOUT_UNCONFIRMED =
  'You’re logged out on this device, but we couldn’t confirm that the server ended your session. ' +
  'It may stay valid until it expires. Check your connection; if this is a shared device, close the browser or app.';

/**
 * Logs this device out (FR4). `scope: 'local'` removes the stored session before Auth is contacted, so the device is
 * always signed out; an error means only the server-side revocation is unconfirmed (offline, 5xx), and the caller
 * must say so rather than imply the old tokens are dead (NFR12).
 */
export async function signOutDevice(auth: { signOut(options: { scope: 'local' }): Promise<{ error: unknown }> }) {
  const { error } = await auth.signOut({ scope: 'local' });
  return { revoked: !error };
}
