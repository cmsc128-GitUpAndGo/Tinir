import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(),
  handler: undefined as unknown as (request: Request) => Promise<Response>,
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getUser: mock.getUser }, rpc: mock.rpc,
  storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) },
}) }));
vi.mock('../supabase/functions/media/image.ts', () => ({
  ImageError: class extends Error {}, optimizeImage: async () => new Uint8Array([1]),
}));
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal('Deno', { env: { get: () => 'test-key' }, serve: (handler: typeof mock.handler) => { mock.handler = handler; } });
  const handlerPath = '../supabase/functions/media/index.ts';
  await import(handlerPath);
  mock.getUser.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null });
});
it('returns a retryable error when authentication throws', async () => {
  mock.getUser.mockRejectedValue(new Error('network unavailable'));
  const response = await mock.handler(new Request('http://local/media', { method: 'POST', headers: { authorization: 'Bearer user-token' }, body: '{}' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: { code: 'REQUEST_FAILED', message: expect.any(String) } });
});
it('always cancels a reservation when both upload and storage cleanup throw', async () => {
  const listingId = '00000000-0000-4000-8000-000000000001';
  mock.rpc.mockImplementation(async (_name, input) => ({ data: input.operation === 'reserve'
    ? { id: 'photo', listing_id: listingId, storage_key: 'object.webp' } : input.operation === 'cleanup' ? [] : {}, error: null }));
  mock.upload.mockRejectedValue(new Error('upload failed'));
  mock.remove.mockRejectedValue(new Error('cleanup failed'));
  const body = new FormData();
  body.set('listing_id', listingId); body.set('file', new Blob(['image'], { type: 'image/png' }), 'photo.png');
  const response = await mock.handler(new Request('http://local/media', { method: 'POST', headers: { authorization: 'Bearer user-token' }, body }));
  expect(response.status).toBe(503);
  expect(mock.rpc).toHaveBeenCalledWith('tinir_media', { operation: 'cancel', actor_id: 'actor', args: { listing_id: listingId, id: 'photo' } });
});
it('keeps malformed client JSON as a validation error', async () => {
  const response = await mock.handler(new Request('http://local/media', { method: 'POST', body: '{' }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
});
