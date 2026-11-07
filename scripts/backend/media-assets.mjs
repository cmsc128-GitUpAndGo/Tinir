import { execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
copyFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm'), 'supabase/functions/media/magick.wasm');
mkdirSync('supabase/functions/media/vendor', { recursive: true });
for (const [name, module] of [['supabase','@supabase/supabase-js'], ['magick','@imagemagick/magick-wasm']]) {
  buildSync({ stdin: { contents: `export * from '${module}';`, resolveDir: process.cwd() },
    outfile: `supabase/functions/media/vendor/${name}.js`, bundle: true, format: 'esm', platform: 'neutral',
    mainFields: ['module','main'], conditions: ['browser','import'], target: 'es2022', external: ['node:*'],
    define: { 'process.env.NODE_ENV': '"production"' } });
}
console.log('Prepared pinned WASM and bundled function dependencies; Edge workers need no npm network access.');

// Fedora SELinux otherwise denies the Edge Runtime read access to this bind mount.
if (process.platform === 'linux') {
  let enforcing = false;
  try { enforcing = execFileSync('getenforce', { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim() === 'Enforcing'; } catch { /* SELinux is absent on most hosts. */ }
  if (enforcing) execFileSync('chcon', ['-R','-t','container_file_t','supabase/functions'], { stdio: 'inherit' });
}
