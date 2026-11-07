import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from './database.types';
import { sessionStorage } from './storage';

let client: SupabaseClient<Database> | undefined;
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured. Run npm run backend:env and restart Expo.');
  if (!url.startsWith('https://') && !__DEV__) throw new Error('Production Supabase connections require HTTPS.');
  client = createClient<Database>(url, key, {
    auth: {
      storage: sessionStorage, storageKey: `tinir-${new URL(url).host.replace(/[^a-zA-Z0-9_-]/g, '_')}-auth`, persistSession: Platform.OS !== 'web' || typeof window !== 'undefined',
      autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', lock: processLock,
    },
  });
  return client;
}
export function isBackendConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
