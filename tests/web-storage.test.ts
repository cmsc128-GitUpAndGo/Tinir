import { expect, it } from 'vitest';
import { webStorage } from '../src/lib/supabase/web-storage';
function memory(): Storage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }, clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null, get length() { return values.size; } };
}
it('makes a signup verifier available in another tab while keeping sessions per tab', async () => {
  const localStorage = memory();
  const firstTab = { localStorage, sessionStorage: memory() } as Window;
  const secondTab = { localStorage, sessionStorage: memory() } as Window;
  const first = webStorage(() => firstTab);
  const second = webStorage(() => secondTab);
  for (const key of ['tinir-auth-code-verifier', 'tinir-auth-flow-abc-code-verifier', 'tinir-auth-flows-code-verifier']) {
    await first.setItem(key, 'pkce-secret');
    expect(await second.getItem(key)).toBe('pkce-secret');
  }
  await first.setItem('tinir-auth', 'session-token');
  expect(await second.getItem('tinir-auth-code-verifier')).toBe('pkce-secret');
  expect(await second.getItem('tinir-auth')).toBeNull();
  await second.removeItem('tinir-auth-code-verifier');
  expect(await first.getItem('tinir-auth-code-verifier')).toBeNull();
  expect(await first.getItem('tinir-auth')).toBe('session-token');
});
it('does not access browser storage during server rendering', async () => {
  const storage = webStorage(() => undefined);
  await storage.setItem('auth', 'session');
  expect(await storage.getItem('auth')).toBeNull();
  await storage.removeItem('auth');
});
