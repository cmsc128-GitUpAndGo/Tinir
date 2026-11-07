import { describe, expect, it } from 'vitest';
import { chunkedStorage, type KeyValueStore } from '../src/lib/supabase/secure-storage';
function memory() {
  const values = new Map<string, string>();
  const store: KeyValueStore = { getItem: async (k) => values.get(k) ?? null, setItem: async (k, v) => { values.set(k, v); }, removeItem: async (k) => { values.delete(k); } };
  return { values, store };
}
describe('native secure session storage', () => {
  it('round-trips large Unicode sessions, replaces them, and clears every chunk on logout', async () => {
    const { values, store } = memory(); const storage = chunkedStorage(store);
    const session = JSON.stringify({ refresh_token: 'token'.repeat(1000), metadata: '🌴'.repeat(700) });
    await storage.setItem('auth', session);
    expect(await storage.getItem('auth')).toBe(session);
    expect([...values.values()].every((v) => new TextEncoder().encode(v).length < 2048)).toBe(true);
    await storage.setItem('auth', 'new-session'); expect(await storage.getItem('auth')).toBe('new-session');
    expect(values.size).toBe(2);
    await storage.removeItem('auth'); expect(values.size).toBe(0);
  });
  it('preserves emoji at every chunk boundary through native UTF-8 encoding', async () => {
    for (const padding of [384, 385, 386, 784, 785]) {
      const { store, values } = memory();
      const storage = chunkedStorage({ ...store, setItem: async (key, value) => {
        await store.setItem(key, new TextDecoder().decode(new TextEncoder().encode(value)));
      } });
      const session = JSON.stringify({ full_name: 'x'.repeat(padding) + '🍌'.repeat(500) });
      await storage.setItem('auth', session);
      expect(await storage.getItem('auth')).toBe(session);
      expect([...values.values()].every((value) => new TextEncoder().encode(value).length < 2048)).toBe(true);
    }
  });
  it('preserves the previous committed session if a chunk write fails', async () => {
    const { values, store } = memory(); let fail = false;
    const storage = chunkedStorage({ ...store, setItem: async (k, v) => { if (fail && k.endsWith('.1')) throw new Error('keychain unavailable'); await store.setItem(k,v); } });
    await storage.setItem('auth','old'); fail=true;
    await expect(storage.setItem('auth','x'.repeat(1500))).rejects.toThrow();
    expect(await storage.getItem('auth')).toBe('old'); expect(values.size).toBe(2);
  });
  it('serializes concurrent session replacements and rejects incomplete or malformed records', async () => {
    const { store, values } = memory(); const storage = chunkedStorage(store);
    await Promise.all([storage.setItem('auth','one'),storage.setItem('auth','two')]);
    expect(await storage.getItem('auth')).toBe('two');
    values.set('auth','{"version":1,"chunks":999999,"generation":"x"}'); expect(await storage.getItem('auth')).toBeNull();
    values.set('auth','{"version":1,"chunks":1,"generation":"missing"}'); expect(await storage.getItem('auth')).toBeNull();
  });
});
