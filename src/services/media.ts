import { getSupabase } from '@/lib/supabase/client';
import { backendError, BackendError } from './errors';

async function invoke<T>(body: object | FormData, headers?: Record<string, string>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('media', { body, headers });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      const payload = await response.json().catch(() => null);
      if (payload?.error?.code) throw backendError({ message: JSON.stringify(payload.error) });
    }
    throw backendError(error);
  }
  return data as T;
}
export const media = {
  upload: (listingId: string, file: Blob | { uri: string; name: string; type: string }) => {
    if ('size' in file && file.size > 5 * 1024 * 1024) throw new BackendError('INVALID_INPUT', 'Photos must be 5 MB or smaller.');
    const form = new FormData();
    form.append('listing_id', listingId);
    form.append('file', file as Blob);
    return invoke<{ id: string }>(form);
  },
  url: async (id: string) => {
    const result = await invoke<{ url: string; expires_in: number }>({ operation: 'read', id });
    return { ...result, url: new URL(result.url, process.env.EXPO_PUBLIC_SUPABASE_URL).toString() };
  },
  remove: (listingId: string, id: string) => invoke<{ removed: boolean }>({ operation: 'delete', listing_id: listingId, id }),
};
