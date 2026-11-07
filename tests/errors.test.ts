import { expect, it } from 'vitest';
import { backendError } from '../src/services/errors';
it('preserves deliberate application errors and hides raw database/provider diagnostics', () => {
  expect(backendError({ message: '{"code":"EMAIL_UNVERIFIED","message":"Verify your email."}' }).error.code).toBe('EMAIL_UNVERIFIED');
  const raw = backendError({ message: 'secret database query and contact details', code: 'XX000' });
  expect(JSON.stringify(raw.error)).not.toContain('secret');
  expect(backendError({ code: '23514' }).error.code).toBe('INVALID_INPUT');
  expect(backendError({ code: '23505' }).error.code).toBe('CONFLICT');
});
