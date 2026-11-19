import { useCallback, useEffect, useState } from 'react';

import { isBackendConfigured } from '@/lib/supabase/client';
import { listings } from '@/services/backend';

/** The amenity names listings can be filtered by (FR12), from the server's reference list. */
export function useAmenities() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; names: string[] | null } | null>(null);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    let active = true;
    listings.amenities()
      .then((rows) => { if (active) setResult({ attempt, names: rows.map((row) => row.name) }); })
      .catch(() => { if (active) setResult({ attempt, names: null }); });
    return () => { active = false; };
  }, [attempt]);

  const current = result?.attempt === attempt ? result : null;
  return {
    names: current?.names ?? [],
    status: !isBackendConfigured() || (current && current.names === null) ? 'error' as const : current ? 'ready' as const : 'loading' as const,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
