import { existsSync, writeFileSync } from 'node:fs';
import { localStatus } from './local-status.mjs';
if (existsSync('.env.local') && !process.argv.includes('--force')) throw new Error('.env.local already exists. Preserve its settings, or rerun with --force to replace it.');
const status = localStatus();
writeFileSync('.env.local', `EXPO_PUBLIC_SUPABASE_URL=${status.API_URL}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY ?? status.ANON_KEY}\n`, { mode: 0o600 });
console.log('Wrote local public connection settings to .env.local; no privileged key was exported.');
