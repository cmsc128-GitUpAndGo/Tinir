import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { getSupabase, isBackendConfigured } from './client';

const SessionContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export const useSession = () => useContext(SessionContext);
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => isBackendConfigured());
  useEffect(() => {
    if (!isBackendConfigured()) return;
    const client = getSupabase();
    let active = true;
    let changed = false;
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (active) { setSession(next); setLoading(false); }
    });
    void client.auth.getSession().then(({ data }) => {
      if (active && !changed) { setSession(data.session); setLoading(false); }
    }).catch(() => { if (active) { setSession(null); setLoading(false); } });
    const refresh = (state: string | null | undefined) => {
      if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh();
    };
    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    return () => { active = false; listener.subscription.unsubscribe(); appState?.remove(); if (Platform.OS !== 'web') client.auth.stopAutoRefresh(); };
  }, []);
  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}
