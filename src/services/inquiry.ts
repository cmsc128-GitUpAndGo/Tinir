import type { Decision } from './contracts';
import { backendError } from './errors';

const DECISIONS: Record<Decision, string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };

/** FR8: the badge text for an owner's decision. Unknown values read as Pending rather than as a decision. */
export function decisionLabel(status: Decision): string {
  return DECISIONS[status] ?? 'Pending';
}

/** The server's limit on an inquiry message (app_private.inquiries.message). */
export const QUESTION_MAX = 4000;

/** FR7: a question must say something; the server applies the same rule. */
export function validateQuestion(message: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = message.trim();
  if (!value) return { ok: false, error: 'Write your question before sending.' };
  if (value.length > QUESTION_MAX) return { ok: false, error: `Keep your question under ${QUESTION_MAX.toLocaleString('en-PH')} characters.` };
  return { ok: true, value };
}

/** What a failed send tells the student. Their typed question is kept by the caller (FR7, NFR12). */
export function sendFailure(error: unknown): string {
  const failure = backendError(error).error;
  switch (failure.code) {
    case 'NOT_FOUND': return 'This listing is no longer available, so the inquiry wasn’t sent.';
    case 'EMAIL_UNVERIFIED': return 'Verify your email before sending inquiries.';
    case 'UNAUTHENTICATED': return 'Your session ended. Log in again to send this inquiry.';
    default: return failure.message;
  }
}
