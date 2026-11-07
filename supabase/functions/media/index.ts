import { createClient } from '@supabase/supabase-js';
import { ImageError, optimizeImage } from './image.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const bucket = admin.storage.from('listing-photos');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
class Failure extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function invalid(message: string): never { throw new Failure('INVALID_INPUT', message); }
async function rpc(operation: string, actorId: string | null, args: object) {
  const { data, error } = await admin.rpc('tinir_media', { operation, actor_id: actorId, args });
  if (error || data?.error) {
    let safe: { code: string; message: string } | undefined;
    try { safe = data?.error ?? JSON.parse(error?.message ?? ''); } catch { /* Never return raw database diagnostics. */ }
    if (safe && ['UNAUTHENTICATED', 'EMAIL_UNVERIFIED', 'FORBIDDEN', 'NOT_FOUND', 'RATE_LIMITED', 'INVALID_INPUT'].includes(safe.code)) {
      throw new Failure(safe.code, safe.message, safe.code === 'UNAUTHENTICATED' ? 401 : ['FORBIDDEN', 'EMAIL_UNVERIFIED'].includes(safe.code) ? 403 : safe.code === 'NOT_FOUND' ? 404 : safe.code === 'RATE_LIMITED' ? 429 : 400);
    }
    throw new Failure('REQUEST_FAILED', 'The photo operation failed.', 500);
  }
  return data;
}
async function cleanup(actorId: string, listingId: string) {
  const pending: { storage_key: string }[] = await rpc('cleanup', actorId, { listing_id: listingId });
  if (!pending.length) return;
  const keys = pending.map((photo) => photo.storage_key);
  const { error } = await bucket.remove(keys);
  if (error) return; // Keep the durable queue for the next retry.
  await rpc('cleanup_done', actorId, { listing_id: listingId, storage_keys: keys });
}
async function boundedBody(req: Request, limit: number) {
  if (Number(req.headers.get('content-length') ?? 0) > limit) invalid('Request is too large.');
  const reader = req.body?.getReader(); if (!reader) invalid('A request body is required.');
  let size = 0; const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); invalid('Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  let reserved: { id: string; listing_id: string; storage_key: string } | undefined;
  let actorId: string | null = null;
  try {
    if (req.method !== 'POST') throw new Failure('INVALID_INPUT', 'Use POST.', 405);
    const authorization = req.headers.get('authorization');
    // Supabase clients send the publishable/anon key for guest calls. Only user tokens identify actors.
    if (authorization?.startsWith('Bearer ') && authorization.slice(7) !== Deno.env.get('SUPABASE_ANON_KEY') && !authorization.slice(7).startsWith('sb_publishable_')) {
      const { data, error } = await admin.auth.getUser(authorization.slice(7));
      if (error && (!error.status || error.status >= 500)) throw new Failure('REQUEST_FAILED', 'Authentication is temporarily unavailable.', 503);
      if (error || !data.user) throw new Failure('UNAUTHENTICATED', 'Please log in.', 401);
      actorId = data.user.id;
    }
    if (req.headers.get('content-type')?.startsWith('multipart/form-data')) {
      if (!actorId) throw new Failure('UNAUTHENTICATED', 'Please log in.', 401);
      const bytes = await boundedBody(req, 5 * 1024 * 1024 + 65536);
      let form: FormData;
      try { form = await new Response(bytes, { headers: { 'content-type': req.headers.get('content-type')! } }).formData(); }
      catch { invalid('Invalid multipart request.'); }
      const listingId = form.get('listing_id'); const file = form.get('file');
      if (!uuid(listingId) || !(file instanceof File)) invalid('Select a listing and an image.');
      if (file.size > 5 * 1024 * 1024) invalid('Photos must be 5 MB or smaller.');
      // Reserve under a listing lock before spending CPU. This enforces owner/verification and the 10-photo cap.
      reserved = await rpc('reserve', actorId, { listing_id: listingId });
      await cleanup(actorId, listingId).catch(() => undefined);
      const image = await optimizeImage(new Uint8Array(await file.arrayBuffer()), file.type);
      const { error } = await bucket.upload(reserved!.storage_key, image, { contentType: 'image/webp', upsert: false });
      if (error) throw new Failure('REQUEST_FAILED', 'The photo could not be stored.', 500);
      await rpc('finalize', actorId, { listing_id: listingId, id: reserved!.id });
      return Response.json({ id: reserved!.id }, { headers, status: 201 });
    }
    const body = await boundedBody(req, 16384);
    let input;
    try { input = JSON.parse(new TextDecoder().decode(body)); } catch { invalid('Invalid JSON request.'); }
    if (!input || typeof input !== 'object') invalid('Expected a photo request.');
    if (!uuid(input.id)) invalid('A valid photo ID is required.');
    if (input.operation === 'read') {
      const photo = await rpc('read', actorId, { id: input.id });
      const { data, error } = await bucket.createSignedUrl(photo.storage_key, 60);
      if (error) throw new Failure('REQUEST_FAILED', 'The photo could not be opened.', 500);
      const signed = new URL(data.signedUrl);
      return Response.json({ url: signed.pathname + signed.search, expires_in: 60 }, { headers });
    }
    if (input.operation === 'delete' && uuid(input.listing_id)) {
      if (!actorId) throw new Failure('UNAUTHENTICATED', 'Please log in.', 401);
      const photo = await rpc('delete', actorId, { id: input.id, listing_id: input.listing_id });
      const { error } = await bucket.remove([photo.storage_key]);
      // Deleted metadata queues its object key, so Storage failures remain retryable.
      if (error) throw new Failure('REQUEST_FAILED', 'Photo removed from the listing; storage cleanup must be retried by an operator.', 500);
      await rpc('cleanup_done', actorId, { listing_id: input.listing_id, storage_keys: [photo.storage_key] });
      return Response.json({ removed: true }, { headers });
    }
    invalid('Unknown photo operation.');
  } catch (error) {
    if (reserved) {
      // Cancellation always runs, including when Storage throws; deletion queues the key.
      try { await bucket.remove([reserved.storage_key]); } catch { /* Retry through the durable queue. */ }
      await rpc('cancel', actorId, { listing_id: reserved.listing_id, id: reserved.id }).catch(() => undefined);
      if (actorId) await cleanup(actorId, reserved.listing_id).catch(() => undefined);
    }
    const failure = error instanceof Failure ? error : error instanceof ImageError ? new Failure('INVALID_INPUT', error.message) : new Failure('REQUEST_FAILED', 'The photo service is temporarily unavailable. Try again.', 503);
    return Response.json({ error: { code: failure.code, message: failure.message } }, { headers, status: failure.status });
  }
});
