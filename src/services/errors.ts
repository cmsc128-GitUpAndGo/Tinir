import type { BackendErrorShape } from './contracts';
export class BackendError extends Error implements BackendErrorShape {
  error: BackendErrorShape['error'];
  constructor(code: string, message: string, fields?: Record<string, string>) {
    super(message); this.name = 'BackendError'; this.error = { code, message, ...(fields ? { fields } : {}) };
  }
}
const safeCodes = new Set(['INVALID_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'EMAIL_UNVERIFIED', 'RATE_LIMITED']);
export function backendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const e = error as { code?: string; message?: string };
  try {
    const value = JSON.parse(e?.message ?? '') as { code: string; message: string };
    if (safeCodes.has(value.code) && typeof value.message === 'string') return new BackendError(value.code, value.message);
  } catch { /* Raw SQL/provider diagnostics are deliberately not user-facing. */ }
  if (e?.code === '23505') return new BackendError('CONFLICT', 'This record already exists or conflicts with another pending request.');
  if (['23514', '23502', '23503', '22P02', '22003', '22023', '22001'].includes(e?.code ?? '')) return new BackendError('INVALID_INPUT', 'Check the submitted fields and try again.');
  if (e?.code === '42501' || e?.code === 'PGRST301') return new BackendError('FORBIDDEN', 'You do not have access to this operation.');
  if (e?.code === 'email_not_confirmed') return new BackendError('EMAIL_UNVERIFIED', 'Verify your email before logging in.');
  if (e?.code === 'invalid_credentials') return new BackendError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (e?.code?.startsWith('over_')) return new BackendError('RATE_LIMITED', 'Too many requests. Try again later.');
  return new BackendError('REQUEST_FAILED', 'The request could not be completed. Check your connection and try again.');
}
