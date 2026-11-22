import { useCallback, useEffect, useState } from 'react';

import { isBackendConfigured } from '@/lib/supabase/client';
import { listings } from '@/services/backend';

/** The server's amenity reference list: names for search filters (FR12), IDs for listing forms (FR9). */
export function useAmenities() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; rows: { id: string; name: string }[] | null } | null>(null);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    let active = true;
    listings.amenities()
      .then((rows) => { if (active) setResult({ attempt, rows }); })
      .catch(() => { if (active) setResult({ attempt, rows: null }); });
    return () => { active = false; };
  }, [attempt]);

  const current = result?.attempt === attempt ? result : null;
  return {
    rows: current?.rows ?? [],
    names: (current?.rows ?? []).map((row) => row.name),
    status: !isBackendConfigured() || (current && current.rows === null) ? 'error' as const : current ? 'ready' as const : 'loading' as const,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
