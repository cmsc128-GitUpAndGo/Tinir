import { describe, expect, it } from 'vitest';
import type { Decision } from '../src/services/contracts';
import { decisionLabel, QUESTION_MAX, sendFailure, validateQuestion } from '../src/services/inquiry';

describe('inquiry decision badges (FR8)', () => {
  it('labels each decision and never invents one', () => {
    expect(decisionLabel('pending')).toBe('Pending');
    expect(decisionLabel('accepted')).toBe('Accepted');
    expect(decisionLabel('rejected')).toBe('Rejected');
    expect(decisionLabel('reserved' as Decision)).toBe('Pending');
  });
});

describe('sending an inquiry (FR7, NFR12)', () => {
  it('requires a question with content and trims it', () => {
    expect(validateQuestion('  Is water included?  ')).toEqual({ ok: true, value: 'Is water included?' });
    expect(validateQuestion('')).toMatchObject({ ok: false });
    expect(validateQuestion(' \n\t ')).toMatchObject({ ok: false });
  });

  it('enforces the server message limit', () => {
    expect(validateQuestion('a'.repeat(QUESTION_MAX)).ok).toBe(true);
    expect(validateQuestion('a'.repeat(QUESTION_MAX + 1))).toMatchObject({ ok: false });
  });

  it('explains failures without raw diagnostics', () => {
    expect(sendFailure({ message: '{"code":"NOT_FOUND","message":"Listing not found."}' })).toMatch(/no longer available/);
    expect(sendFailure({ message: '{"code":"RATE_LIMITED","message":"Too many requests. Try again in a minute."}' })).toMatch(/Try again/);
    expect(sendFailure({ message: '{"code":"EMAIL_UNVERIFIED","message":"Verify your email before continuing."}' })).toMatch(/Verify your email/);
    expect(sendFailure({ message: 'duplicate key value violates unique constraint "one_pending_interest"', code: 'XX000' }))
      .not.toContain('one_pending_interest');
  });
});
