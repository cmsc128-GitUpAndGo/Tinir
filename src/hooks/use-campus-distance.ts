import { useCallback, useEffect, useState } from 'react';

import { listings } from '@/services/backend';
import { readCampusDistances, type CampusDistanceState } from '@/services/campus-distance';

/** Campus distances for one listing (FR14). A result for another listing or attempt is never shown. */
export function useCampusDistance(listingId: string) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: CampusDistanceState } | null>(null);
  const key = `${listingId}|${attempt}`;

  useEffect(() => {
    let active = true;
    void readCampusDistances(listingId, listings).then((state) => { if (active) setLoaded({ key, state }); });
    return () => { active = false; };
  }, [listingId, key]);

  const state: CampusDistanceState = loaded?.key === key ? loaded.state : { status: 'loading' };
  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
