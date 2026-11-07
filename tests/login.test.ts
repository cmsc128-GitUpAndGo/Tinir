import { describe, expect, it } from 'vitest';

import { INVALID_LOGIN, loginError, validateLogin } from '../src/services/login';

describe('validateLogin (FR4)', () => {
  it('normalises the email and keeps the password exactly as typed', () => {
    expect(validateLogin({ email: '  Student@Example.TEST ', password: ' pass word1 ' }))
      .toEqual({ ok: true, value: { email: 'student@example.test', password: ' pass word1 ' } });
  });
  it('asks for missing or malformed fields', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({ ok: false, fields: { email: 'Enter your email.', password: 'Enter your password.' } });
    expect(validateLogin({ email: 'not-an-email', password: 'x' })).toEqual({ ok: false, fields: { email: 'Enter a valid email address.' } });
  });
});

describe('loginError (FR4 / NFR5)', () => {
  it('gives wrong passwords and unknown addresses the same message', () => {
    const messages = ['invalid_credentials', 'user_not_found', 'validation_failed'].map((code) => loginError({ code, message: 'raw' }).error);
    for (const message of messages) expect(message).toEqual({ code: 'INVALID_CREDENTIALS', message: INVALID_LOGIN });
  });
  it('tells the account holder to verify their email', () => {
    expect(loginError({ code: 'email_not_confirmed' }).error.code).toBe('EMAIL_UNVERIFIED');
  });
  it('maps Auth rate limits without leaking provider text', () => {
    expect(loginError({ code: 'over_request_rate_limit', message: 'raw provider text' }).error)
      .toEqual({ code: 'RATE_LIMITED', message: 'Too many login attempts. Wait a minute and try again.' });
  });
  it('falls back to the generic request failure', () => {
    expect(loginError(new Error('socket hang up')).error.code).toBe('REQUEST_FAILED');
  });
});
