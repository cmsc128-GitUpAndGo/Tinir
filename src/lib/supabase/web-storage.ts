import type { KeyValueStore } from './secure-storage';

/** Share only PKCE verifiers across tabs; sessions remain scoped to each tab. */
export function webStorage(browser: () => Pick<Window, 'localStorage' | 'sessionStorage'> | undefined = () => typeof window === 'undefined' ? undefined : window): KeyValueStore {
  const storage = (key: string) => {
    const target = browser();
    return key.endsWith('-code-verifier') ? target?.localStorage : target?.sessionStorage;
  };
  return {
    getItem: async (key) => storage(key)?.getItem(key) ?? null,
    setItem: async (key, value) => { storage(key)?.setItem(key, value); },
    removeItem: async (key) => { storage(key)?.removeItem(key); },
  };
}
