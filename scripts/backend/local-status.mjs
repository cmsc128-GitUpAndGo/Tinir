import { supabase } from './cli.mjs';
export function localStatus() {
  let status;
  try { status = JSON.parse(supabase(['status', '-o', 'json'])); }
  catch { throw new Error('Tinir local Supabase is unavailable. Run npm run backend:start first.'); }
  const url = new URL(status.API_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '54621') throw new Error('Refusing to operate on a database outside the Tinir local stack.');
  return status;
}
