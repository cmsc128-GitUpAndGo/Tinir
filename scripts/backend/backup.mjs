import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { localStatus } from './local-status.mjs';
localStatus(); // Local-only: never accepts a production URL or password argument.
const directory = join(homedir(), '.local/share/tinir/backups');
mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
const docker = (args, options = {}) => execFileSync('docker', args, { maxBuffer: 64*1024*1024, ...options });
if (process.argv[2] === 'dump') {
  const data = docker(['exec', 'supabase_db_tinir', 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema', 'app_private', '--schema', 'auth', '--no-owner', '--no-acl']);
  const name = `${new Date().toISOString().replace(/[:.]/g,'-')}.sql.gz`;
  writeFileSync(join(directory, name), gzipSync(data), { mode: 0o600 });
  console.log(`Saved a private local database backup in ${directory}. Storage image bytes are not included.`);
} else if (process.argv[2] === 'verify') {
  const file = process.argv[3] ?? join(directory, readdirSync(directory).filter((n) => n.endsWith('.sql.gz')).sort().at(-1) ?? '');
  if (!existsSync(file) || !file.endsWith('.sql.gz')) throw new Error('Create a backup first or specify a .sql.gz backup file.');
  const database = `tinir_restore_${process.pid}_${Date.now()}`;
  const sql = (query) => docker(['exec', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', query]);
  // Restore into a fresh template copy of the installed Supabase infrastructure; never into the app DB.
  sql(`CREATE DATABASE ${database} TEMPLATE template0`);
  try {
    // auth schema types reference extensions; the application schema needs auth.uid().
    docker(['exec', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;']);
    const dump = gunzipSync(readFileSync(file));
    const lines = dump.toString().split('\n');
    const expected = Object.fromEntries(['profiles','listings','inquiries','saved_listings'].map((table) => {
      const start = lines.findIndex((line) => line.startsWith('COPY app_private.'+table+' (') && line.endsWith(' FROM stdin;'));
      const end = lines.indexOf('\\.', start + 1);
      if (start < 0 || end < 0) throw new Error('Backup is missing expected application data sections.');
      return [table === 'saved_listings' ? 'bookmarks' : table, end - start - 1];
    }));
    docker(['exec', '-i', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], { input: dump });
    const counts = "SELECT json_build_object('profiles',(SELECT count(*) FROM app_private.profiles),'listings',(SELECT count(*) FROM app_private.listings),'inquiries',(SELECT count(*) FROM app_private.inquiries),'bookmarks',(SELECT count(*) FROM app_private.saved_listings))";
    const restored = docker(['exec', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', database, '-Atc', counts]).toString().trim();
    assert.deepEqual(JSON.parse(restored), expected, 'Restored table counts must match the backup COPY data.');
    console.log(`Restore completed in a separate database; counts match the backup: ${restored}`);
  } finally { sql(`DROP DATABASE ${database} WITH (FORCE)`); }
} else throw new Error('Use dump or verify.');
