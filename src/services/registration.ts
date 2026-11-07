import { z } from 'zod';

import { backendError, BackendError } from './errors';

/** Matches the server's profiles_contact_number_format check. */
export const CONTACT_NUMBER = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;

const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const schema = z.object({
  role: z.enum(['student', 'owner'], 'Choose Student or Property Owner.'),
  full_name: z.string('Enter your full name.').trim().min(1, 'Enter your full name.').max(120, 'Use 120 characters or fewer.'),
  email: z.string('Enter a valid email address.').trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(255, 'Use 255 characters or fewer.')),
  password: z.string('Enter a password.')
    .min(8, 'Use at least 8 characters.')
    .max(128, 'Use 128 characters or fewer.')
    .regex(/[a-zA-Z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
  contact_number: z.preprocess(blank, z.string().trim().regex(CONTACT_NUMBER, 'Enter a valid phone number, e.g. 09171234567.').optional()),
  college_program: z.preprocess(blank, z.string().trim().max(120, 'Use 120 characters or fewer.').optional()),
}).superRefine((value, ctx) => {
  if (value.role === 'owner' && !value.contact_number) {
    ctx.addIssue({ code: 'custom', path: ['contact_number'], message: 'Property owners need a contact number.' });
  }
}).transform(({ college_program, ...value }) =>
  // College/program is collected for students only (NFR7).
  value.role === 'student' && college_program ? { ...value, college_program } : value);

export type RegistrationForm = {
  role: 'student' | 'owner' | null;
  full_name: string;
  email: string;
  password: string;
  contact_number?: string;
  college_program?: string;
};
export type Registration = z.output<typeof schema>;
export type FieldErrors = Partial<Record<keyof RegistrationForm, string>>;

export function validateRegistration(form: RegistrationForm):
  { ok: true; value: Registration } | { ok: false; fields: FieldErrors } {
  const parsed = schema.safeParse(form);
  if (parsed.success) return { ok: true, value: parsed.data };
  const fields: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof RegistrationForm;
    fields[key] ??= issue.message;
  }
  return { ok: false, fields };
}

export const REGISTERED_MESSAGE = 'Check your email to verify your account.';

/**
 * Maps a Supabase signUp failure to safe feedback. Returns null when the failure must look like success,
 * so the form never reveals whether an email is already registered.
 */
export function signupError(error: { code?: string; status?: number; message?: string }): BackendError | null {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
    // Auth sends one email per address per minute, so a repeat signup is throttled only when the
    // address was just used. Reporting the throttle would reveal that; an email did just go out.
    case 'over_email_send_rate_limit':
      return null;
    case 'weak_password':
      return new BackendError('INVALID_INPUT', 'Choose a stronger password.', { password: 'Use at least 8 characters with a letter and a number.' });
    case 'email_address_invalid':
    case 'validation_failed':
      return new BackendError('INVALID_INPUT', 'Check the registration fields.', { email: 'Enter a valid email address.' });
    case 'signup_disabled':
      return new BackendError('REQUEST_FAILED', 'Registration is currently closed.');
  }
  // The profile rules run inside Auth's signup transaction; their failure surfaces as a generic database error.
  if (error.code === 'unexpected_failure' || (error.status === 500 && /database error/i.test(error.message ?? ''))) {
    return new BackendError('INVALID_INPUT', 'Check the registration fields and try again.');
  }
  return backendError(error);
}
