import { expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => ({ rpc: mock.rpc }) }));
import { listings } from '../src/services/backend';
it('turns committed mutation error envelopes into BackendError', async () => {
  mock.rpc.mockResolvedValue({ data: { error: { code: 'INVALID_INPUT', message: 'Check the fields.' } }, error: null });
  await expect(listings.archive('fixture')).rejects.toMatchObject({ error: { code: 'INVALID_INPUT', message: 'Check the fields.' } });
});
it('still handles transport errors such as an exceeded rate limit', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: '{"code":"RATE_LIMITED","message":"Try again later."}' } });
  await expect(listings.archive('fixture')).rejects.toMatchObject({ error: { code: 'RATE_LIMITED' } });
});
it('returns successful mutation data unchanged', async () => {
  mock.rpc.mockResolvedValue({ data: { id: 'fixture', status: 'archived' }, error: null });
  expect(await listings.archive('fixture')).toEqual({ id: 'fixture', status: 'archived' });
});
