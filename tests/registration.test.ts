import { describe, expect, it } from 'vitest';
import { signupError, signupOutcome, validateRegistration, type RegistrationForm } from '../src/services/registration';

const student: RegistrationForm = { role: 'student', full_name: ' Ana Reyes ', email: ' Ana@Example.TEST ', password: 'secret123' };
const owner: RegistrationForm = { role: 'owner', full_name: 'Ben Cruz', email: 'ben@example.test', password: 'secret123', contact_number: '0917 123 4567' };

describe('registration validation (FR3, NFR6, NFR7)', () => {
  it('accepts both roles and normalizes input', () => {
    const s = validateRegistration(student);
    expect(s).toEqual({ ok: true, value: { role: 'student', full_name: 'Ana Reyes', email: 'ana@example.test', password: 'secret123' } });
    const o = validateRegistration(owner);
    expect(o.ok && o.value.contact_number).toBe('0917 123 4567');
  });

  it('requires a role and rejects unsupported roles', () => {
    expect(validateRegistration({ ...student, role: null })).toMatchObject({ ok: false, fields: { role: 'Choose Student or Property Owner.' } });
    expect(validateRegistration({ ...student, role: 'admin' as 'owner' }).ok).toBe(false);
  });

  it('reports each missing or invalid field', () => {
    const result = validateRegistration({ role: 'student', full_name: '  ', email: 'not-an-email', password: 'short' });
    expect(result).toMatchObject({ ok: false, fields: { full_name: 'Enter your full name.', email: 'Enter a valid email address.', password: 'Use at least 8 characters.' } });
    expect(validateRegistration({ ...student, password: 'lettersonly' })).toMatchObject({ fields: { password: 'Include at least one number.' } });
    expect(validateRegistration({ ...student, password: '12345678' })).toMatchObject({ fields: { password: 'Include at least one letter.' } });
  });

  it('requires a valid contact number for owners only', () => {
    expect(validateRegistration({ ...owner, contact_number: '' })).toMatchObject({ fields: { contact_number: 'Property owners need a contact number.' } });
    expect(validateRegistration({ ...owner, contact_number: 'call me' }).ok).toBe(false);
    expect(validateRegistration({ ...student, contact_number: '' }).ok).toBe(true);
  });

  it('keeps college/program for students and drops it for owners', () => {
    const s = validateRegistration({ ...student, college_program: 'BS Computer Science' });
    expect(s.ok && s.value).toMatchObject({ college_program: 'BS Computer Science' });
    const o = validateRegistration({ ...owner, college_program: 'BS Computer Science' });
    expect(o.ok && 'college_program' in o.value).toBe(false);
  });

  it('never puts the password in feedback', () => {
    const result = validateRegistration({ ...student, password: 'hunter2hunter2'.repeat(20) });
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });
});

describe('signup error mapping', () => {
  it('treats an existing email like success so accounts are not disclosed', () => {
    expect(signupError({ code: 'user_already_exists' })).toBeNull();
    expect(signupError({ code: 'email_exists' })).toBeNull();
    expect(signupOutcome({ code: 'user_already_exists' })).toEqual({ ok: true, delivery: 'sent' });
    expect(signupOutcome(null)).toEqual({ ok: true, delivery: 'sent' });
  });

  it('makes no delivery claim when Auth throttles email, whether per address or project-wide', () => {
    // Auth uses this one code for the per-address cooldown and for the project's email-send quota.
    const quota = { code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' };
    expect(signupOutcome(quota)).toEqual({ ok: true, delivery: 'unconfirmed' });
    const cooldown = { ...quota, message: 'For security purposes, you can only request this after 52 seconds.' };
    expect(signupOutcome(cooldown)).toEqual({ ok: true, delivery: 'unconfirmed' });
  });

  it('maps provider and server-rule failures to safe messages', () => {
    expect(signupError({ code: 'weak_password' })?.error.fields?.password).toBeDefined();
    expect(signupError({ code: 'email_address_invalid' })?.error.fields?.email).toBeDefined();
    expect(signupError({ code: 'over_request_rate_limit' })?.error.code).toBe('RATE_LIMITED');
    const db = signupError({ status: 500, message: 'Database error saving new user' });
    expect(db?.error).toEqual({ code: 'INVALID_INPUT', message: 'Check the registration fields and try again.' });
  });
});
