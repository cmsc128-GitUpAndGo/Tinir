/** Chunk session JSON so native keychain entry-size limits do not truncate tokens. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
interface Manifest { version: 1; generation: string; chunks: number }
const CHUNK_SIZE = 400; // <= 1600 UTF-8 bytes, including non-ASCII profile metadata.
const MAX_CHUNKS = 1024;
export function chunkedStorage(store: KeyValueStore): KeyValueStore {
  let queue: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  };
  const manifest = async (key: string): Promise<Manifest | null> => {
    const value = await store.getItem(key);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as Manifest;
      return parsed.version === 1 && /^[\w.-]+$/.test(parsed.generation) &&
        Number.isInteger(parsed.chunks) && parsed.chunks > 0 && parsed.chunks <= MAX_CHUNKS ? parsed : null;
    } catch { return null; }
  };
  const chunkKey = (key: string, m: Manifest, i: number) => `${key}.${m.generation}.${i}`;
  const removeChunks = async (key: string, m: Manifest | null) => {
    if (m) await Promise.all(Array.from({ length: m.chunks }, (_, i) => store.removeItem(chunkKey(key, m, i))));
  };
  return {
    getItem: (key) => serial(async () => {
      const m = await manifest(key);
      if (!m) return null;
      const chunks = await Promise.all(Array.from({ length: m.chunks }, (_, i) => store.getItem(chunkKey(key, m, i))));
      return chunks.some((v) => v === null) ? null : chunks.join('');
    }),
    setItem: (key, value) => serial(async () => {
      const old = await manifest(key);
      const m: Manifest = { version: 1, generation: `${Date.now()}.${sequence++}`, chunks: Math.max(1, Math.ceil(value.length / CHUNK_SIZE)) };
      if (m.chunks > MAX_CHUNKS) throw new Error('Session exceeds secure storage capacity.');
      try {
        for (let i = 0; i < m.chunks; i++) await store.setItem(chunkKey(key, m, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
        // Commit the pointer only after every chunk is durable; interrupted writes preserve the old session.
        await store.setItem(key, JSON.stringify(m));
      } catch (error) {
        await removeChunks(key, m).catch(() => undefined);
        throw error;
      }
      await removeChunks(key, old);
    }),
    removeItem: (key) => serial(async () => {
      const old = await manifest(key);
      await store.removeItem(key);
      await removeChunks(key, old);
    }),
  };
}
