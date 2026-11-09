// Seeds fictional owners and listings into the LOCAL Tinir stack for guest browsing (#8).
// Usage: npm run backend:seed-demo [-- --reset]
// Every account uses the reserved .test domain and every listing is synthetic. Never run against shared data.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { ImageMagick, initializeImageMagick, MagickColors, MagickFormat } from '@imagemagick/magick-wasm';
import { localStatus } from './local-status.mjs';

const DOMAIN = 'demo.tinir.test';
const status = localStatus(); // Refuses anything other than the local Tinir API port.
const url = status.API_URL;
const publicKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const secret = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
const client = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(secret);

const sql = (query) => execFileSync('docker', ['exec', '-i', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
  { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

async function demoUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.filter((user) => user.email?.endsWith(`@${DOMAIN}`)));
    if (data.users.length < 200) return users;
  }
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function reset(users) {
  const ids = users.map((user) => quote(user.id)).join(',');
  const listingIds = sql(`SELECT id FROM app_private.listings WHERE owner_id IN (${ids});`).split('\n').filter(Boolean);
  // Only keys whose Storage objects were actually removed may leave the cleanup queue.
  const removed = [];
  for (const id of listingIds) {
    const bucket = admin.storage.from('listing-photos');
    const { data, error } = await bucket.list(id);
    if (error) throw new Error(`Could not list photos for demo listing ${id}: ${error.message}`);
    if (!data?.length) continue;
    const keys = data.map((file) => `${id}/${file.name}`);
    const { error: removeError } = await bucket.remove(keys);
    if (removeError) throw new Error(`Could not remove photos for demo listing ${id}: ${removeError.message}`);
    removed.push(...keys);
  }
  // Deleting a listing queues its photo keys in photo_cleanup. Acknowledge only this reset's demo listings
  // and removed keys; every other queued key is another owner's pending Storage deletion and must stay.
  const acknowledge = listingIds.length && removed.length
    ? `DELETE FROM app_private.photo_cleanup WHERE listing_id IN (${listingIds.map(quote).join(',')}) AND storage_key IN (${removed.map(quote).join(',')});`
    : '';
  sql(`DELETE FROM app_private.inquiries WHERE student_id IN (${ids}) OR listing_id IN (SELECT id FROM app_private.listings WHERE owner_id IN (${ids}));
       DELETE FROM app_private.saved_listings WHERE student_id IN (${ids});
       DELETE FROM app_private.listings WHERE owner_id IN (${ids});
       ${acknowledge}`);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
  console.log(`Removed ${users.length} demo accounts and ${listingIds.length} demo listings.`);
}

async function call(session, operation, args) {
  const { data, error } = await session.rpc('tinir_write', { operation, args });
  if (error) throw new Error(`${operation} failed: ${error.message}`);
  if (data?.error) throw new Error(`${operation} failed: ${data.error.code} ${data.error.message}`);
  return data;
}

async function upload(session, listingId, bytes) {
  const token = (await session.auth.getSession()).data.session.access_token;
  const form = new FormData();
  form.set('listing_id', listingId);
  form.set('file', new Blob([bytes], { type: 'image/png' }), 'cover.png');
  const response = await fetch(`${url}/functions/v1/media`, {
    method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Photo upload failed: ${JSON.stringify(await response.json().catch(() => null))}`);
}

const existing = await demoUsers();
if (existing.length) {
  if (!process.argv.includes('--reset')) {
    console.log(`Demo data already exists (${existing.length} accounts). Rerun with --reset to replace it.`);
    process.exit(0);
  }
  await reset(existing);
}

const require = createRequire(import.meta.url);
await initializeImageMagick(new Uint8Array(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm'))));
const colors = ['SteelBlue', 'SeaGreen', 'Peru', 'CadetBlue', 'IndianRed', 'Goldenrod', 'SlateGray', 'Teal'];
const image = (i) => ImageMagick.read(MagickColors[colors[i % colors.length]], 640, 400, (img) => img.write(MagickFormat.Png, (bytes) => new Uint8Array(bytes)));

const areas = ['Miagao Poblacion', 'Brgy. Sapa', 'Brgy. Mat-y', 'Brgy. Tacas', 'Brgy. Kirayan', 'Brgy. Bolho'];
const types = ['bedspace', 'room', 'apartment'];
const names = { bedspace: 'Shared bedspace', room: 'Private room', apartment: 'Studio apartment' };
const OWNERS = 4;
const PUBLISHED = 26; // More than one 20-item page.

const owners = [];
for (let n = 1; n <= OWNERS; n++) {
  const email = `owner${n}@${DOMAIN}`;
  const password = `Demo-${randomUUID()}`;
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: 'owner', full_name: `Demo Owner ${n}`, contact_number: `0900000000${n}` },
  });
  if (error) throw error;
  const session = client(publicKey);
  const login = await session.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  owners.push({ email, password, session });
}

// Spread listings across owners to stay under the per-owner upload (10/min) and mutation (30/min) limits.
for (let i = 0; i < PUBLISHED + 2; i++) {
  const owner = owners[i % OWNERS].session;
  const type = types[i % types.length];
  const visible = i % 3 !== 1;
  const kind = i === PUBLISHED ? 'draft' : i === PUBLISHED + 1 ? 'archived' : 'published';
  const listing = await call(owner, 'create_listing', {
    title: `${kind === 'published' ? '' : `[${kind}] `}${names[type]} #${i + 1}`,
    property_type: type,
    address: `${100 + i} Fictional Street, ${areas[i % areas.length]}, Miagao, Iloilo`,
    area: areas[i % areas.length],
    description: 'Synthetic listing for local development. Not a real property.',
    latitude: 10.64 + (i % 7) * 0.002, longitude: 122.23 + (i % 5) * 0.002,
    price_amount: (type === 'bedspace' ? 150000 : type === 'room' ? 300000 : 650000) + i * 5000,
    price_visible: visible,
    price_period: i % 4 === 0 ? 'semester' : 'monthly',
    availability_status: i % 6 === 5 ? 'full' : 'available',
  });
  if (kind === 'draft') continue;
  await upload(owner, listing.id, image(i));
  await call(owner, 'publish_listing', { id: listing.id });
  if (kind === 'archived') await call(owner, 'archive_listing', { id: listing.id });
  process.stdout.write('.');
}

console.log(`\nSeeded ${PUBLISHED} published listings, 1 draft, and 1 archived listing across ${OWNERS} demo owners.`);
console.log('Demo owner logins (local only):');
for (const owner of owners) console.log(`  ${owner.email}  ${owner.password}`);
