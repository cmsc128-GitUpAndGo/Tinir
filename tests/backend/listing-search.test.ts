import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localStatus } from '../../scripts/backend/local-status.mjs';

// FR12 search and filters through direct requests, as a guest. Listings carry a unique token in their text
// so these checks are not disturbed by other local data. Accounts and listings are synthetic.
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const admin = createClient(url, status.SERVICE_ROLE_KEY ?? status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const guest = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const token = `zq${randomUUID().slice(0, 8)}`;
let ownerId: string;

function sql(query: string) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_tinir', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
async function search(args: object): Promise<{ code: string; titles: string[] }> {
  const { data, error } = await guest.rpc('tinir_read', { operation: 'listings', args: { q: token, ...args } });
  if (error) {
    try { return { code: (JSON.parse(error.message) as { code: string }).code, titles: [] }; }
    catch { return { code: `DB_${error.code}`, titles: [] }; }
  }
  return { code: 'OK', titles: (data as { items: { title: string }[] }).items.map((i) => i.title).sort() };
}

// title, type, area, price (centavos), visible, status, amenities
const FIXTURES: [string, string, string, number, boolean, string, string[]][] = [
  ['Bedspace A', 'bedspace', 'Sapa', 150000, true, 'published', ['Wi-Fi']],
  ['Bedspace B', 'bedspace', 'Mat-y', 180000, false, 'published', ['Wi-Fi', 'Kitchen']],
  ['Room C', 'room', 'Sapa', 300000, true, 'published', ['Wi-Fi', 'Kitchen']],
  ['Room D', 'room', 'Tacas', 320000, true, 'published', []],
  ['Apartment E', 'apartment', 'Sapa', 650000, true, 'published', ['Kitchen']],
  ['Draft F', 'room', 'Sapa', 300000, true, 'draft', ['Wi-Fi']],
  ['Archived G', 'room', 'Sapa', 300000, true, 'archived', ['Wi-Fi']],
];

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `tinir-search-${randomUUID()}@example.test`, password: `Pw1-${randomUUID()}`, email_confirm: true,
    user_metadata: { role: 'owner', full_name: 'Fictional owner', contact_number: '0917 000 0000' },
  });
  if (error) throw error;
  ownerId = data.user.id;
  const rows = FIXTURES.map(([title, type, area, price, visible, state]) =>
    `('${ownerId}','${title} ${token}','${type}','${area} Street, ${token.toUpperCase()} district','${area}',10.7,122.5,${price},${visible},'${state}')`);
  sql(`INSERT INTO app_private.listings(owner_id,title,property_type,address,area,latitude,longitude,price_amount,price_visible,status)
    VALUES ${rows.join(',')};
    ${FIXTURES.flatMap(([title, , , , , , amenities]) => amenities.map((name) =>
      `INSERT INTO app_private.listing_amenities SELECT l.id,a.id FROM app_private.listings l, app_private.amenities a
        WHERE l.owner_id='${ownerId}' AND l.title='${title} ${token}' AND a.name='${name}';`)).join('\n')}`);
}, 60000);
afterAll(async () => {
  if (!ownerId) return;
  sql(`DELETE FROM app_private.listings WHERE owner_id='${ownerId}'`);
  await admin.auth.admin.deleteUser(ownerId);
});

describe('listing search (FR12)', () => {
  it('matches the keyword in title, address, or area, ignoring case, on published listings only', async () => {
    expect((await search({})).titles.map((t) => t.split(' ').slice(0, 2).join(' ')))
      .toEqual(['Apartment E', 'Bedspace A', 'Bedspace B', 'Room C', 'Room D']);
    const { data } = await guest.rpc('tinir_read', { operation: 'listings', args: { q: `${token.toUpperCase()} DISTRICT` } });
    expect((data as { items: unknown[] }).items).toHaveLength(5);
    const { data: byArea } = await guest.rpc('tinir_read', { operation: 'listings', args: { q: 'tacas street', type: 'room' } });
    expect((byArea as { items: { title: string }[] }).items.map((i) => i.title)).toContain(`Room D ${token}`);
  });

  it('filters by type, price range, and amenities, alone and together', async () => {
    expect((await search({ type: 'room' })).titles).toEqual([`Room C ${token}`, `Room D ${token}`]);
    expect((await search({ min_price: 200000, max_price: 400000 })).titles).toEqual([`Room C ${token}`, `Room D ${token}`]);
    expect((await search({ amenities: ['Wi-Fi', 'Kitchen'] })).titles).toEqual([`Room C ${token}`]);
    expect((await search({ type: 'room', max_price: 310000, amenities: ['Wi-Fi'] })).titles).toEqual([`Room C ${token}`]);
  });

  it('leaves hidden-price listings out of any price range, even when the private amount would match', async () => {
    expect((await search({ type: 'bedspace' })).titles).toEqual([`Bedspace A ${token}`, `Bedspace B ${token}`]);
    expect((await search({ type: 'bedspace', min_price: 170000, max_price: 190000 })).titles).toEqual([]);
    expect((await search({ type: 'bedspace', max_price: 1000000 })).titles).toEqual([`Bedspace A ${token}`]);
  });

  it('keeps the filters on every page', async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => search({ amenities: ['Wi-Fi'], page, page_size: 1 })));
    expect(pages.map((p) => p.titles.length)).toEqual([1, 1, 1]);
    expect(pages.flatMap((p) => p.titles).sort()).toEqual([`Bedspace A ${token}`, `Bedspace B ${token}`, `Room C ${token}`]);
    expect((await search({ amenities: ['Wi-Fi'], page: 4, page_size: 1 })).titles).toEqual([]);
  });

  it('rejects invalid filters with a safe error', async () => {
    for (const args of [{ min_price: 500000, max_price: 100000 }, { min_price: -1 }, { page_size: 51 }, { q: 'x'.repeat(201) }]) {
      expect((await search(args)).code, JSON.stringify(args).slice(0, 40)).toBe('INVALID_INPUT');
    }
  });
});
