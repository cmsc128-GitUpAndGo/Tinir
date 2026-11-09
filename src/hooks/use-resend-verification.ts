import { useCallback, useEffect, useState } from 'react';

import { resendVerification } from '@/services/auth';
import { backendError } from '@/services/errors';

/** Auth allows one verification email per address per minute; mirror that so the button explains the wait. */
export const RESEND_COOLDOWN_SECONDS = 60;

export function useResendVerification(startCoolingDown = false) {
  const [until, setUntil] = useState(() => (startCoolingDown ? Date.now() + RESEND_COOLDOWN_SECONDS * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const resend = useCallback(async (email: string) => {
    setBusy(true);
    setResult(null);
    try {
      const { message } = await resendVerification(email);
      setResult({ tone: 'success', message });
      const next = Date.now();
      setNow(next);
      setUntil(next + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (error) {
      setResult({ tone: 'error', message: backendError(error).error.message });
    } finally {
      setBusy(false);
    }
  }, []);

  return { resend, busy, remaining, result };
}
