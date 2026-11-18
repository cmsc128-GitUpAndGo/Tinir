import { useCallback, useEffect, useState } from 'react';

import { isBackendConfigured } from '@/lib/supabase/client';
import { useSession } from '@/lib/supabase/session-provider';
import { listings } from '@/services/backend';
import { detailFailure, isListingId, type DetailState } from '@/services/listing-detail';

/**
 * One published listing (FR6). The server decides what the caller may see: guests never receive owner
 * contacts or hidden prices. The record is fetched again whenever the signed-in user changes, and a record
 * loaded for another user (or a guest) is never shown, so contacts disappear as soon as someone logs out.
 */
export function useListingDetail(id: string | undefined) {
  const { session, loading } = useSession();
  const userId = session?.user.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: DetailState } | null>(null);
  const valid = isListingId(id);
  const key = `${id}|${userId}|${attempt}`;

  useEffect(() => {
    if (loading || !isListingId(id)) return;
    let active = true;
    const settle = (state: DetailState) => { if (active) setLoaded({ key, state }); };
    if (!isBackendConfigured()) {
      settle({ status: 'error', message: 'This listing is unavailable because the app is not connected to the backend.' });
    } else {
      listings.get(id).then((listing) => settle({ status: 'ready', listing }), (error) => settle(detailFailure(error)));
    }
    return () => { active = false; };
  }, [id, key, loading]);

  const state: DetailState = !valid ? { status: 'unavailable' }
    : loaded?.key === key ? loaded.state
    : { status: 'loading' };
  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
