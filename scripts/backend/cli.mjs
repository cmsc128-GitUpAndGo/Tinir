import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function supabase(args) {
  return execFileSync(process.execPath, [require.resolve('supabase/dist/supabase.js'), ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}
