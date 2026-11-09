import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useSession } from '@/lib/supabase/session-provider';
import type { Viewer } from '@/services/access';
import { currentProfile } from '@/services/backend';
import { backendError } from '@/services/errors';

const ViewerContext = createContext<{ viewer: Viewer; reload: () => void }>({ viewer: { kind: 'loading' }, reload: () => {} });

/** Who is using the app: the server profile decides the role, never client-editable sign-up metadata. */
export const useViewer = () => useContext(ViewerContext);

export function ViewerProvider({ children }: PropsWithChildren) {
  const { session, loading } = useSession();
  const userId = session?.user.id ?? null;
  // Verifying the email updates the session; reloading then picks up the verified profile.
  const confirmedAt = session?.user.email_confirmed_at ?? null;
  const [loaded, setLoaded] = useState<{ userId: string; viewer: Viewer } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    currentProfile()
      .then((profile) => { if (active) setLoaded({ userId, viewer: { kind: 'member', profile } }); })
      .catch((error) => { if (active) setLoaded({ userId, viewer: { kind: 'unknown', message: backendError(error).error.message } }); });
    return () => { active = false; };
  }, [userId, confirmedAt, attempt]);

  const viewer: Viewer = loading ? { kind: 'loading' }
    : !userId ? { kind: 'guest' }
    // A profile loaded for an earlier session is never shown to the next one.
    : loaded?.userId === userId ? loaded.viewer
    : { kind: 'loading' };

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return <ViewerContext.Provider value={{ viewer, reload }}>{children}</ViewerContext.Provider>;
}
