import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { localStatus } from '../../scripts/backend/local-status.mjs';
import { ImageMagick, initializeImageMagick, MagickColors, MagickFormat } from '@imagemagick/magick-wasm';

const shared = vi.hoisted(() => ({ client: undefined as unknown as SupabaseClient }));
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => shared.client }));
import { inquiries, listings, reminders, savedListings, currentProfile } from '../../src/services/backend';

interface Account { id: string; client: SupabaseClient }
const status = localStatus();
const url: string = status.API_URL;
const key: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const secret: string = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
const client = (apiKey = key) => createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(secret); const guest = client();
const accounts: Account[] = [];
let owner: Account, ownerB: Account, student: Account, studentB: Account, unverified: Account;
let hiddenId: string, visibleId: string, photoId: string, photoBytes: Uint8Array;
const campusId = randomUUID(); const semesterId = randomUUID();
function sql(query: string) {
  return execFileSync('docker', ['exec','-i','supabase_db_tinir','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'], { input: query, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
}
const act = (account: Account | SupabaseClient) => { shared.client = 'client' in account ? account.client : account; };
async function account(role: 'owner' | 'student', confirmed = true): Promise<Account> {
  const email = `tinir-test-${randomUUID()}@example.test`; const password = `Test-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: confirmed, user_metadata: { role, full_name: 'Fictional test account', ...(role==='owner' ? { contact_number:'09000000000' } : {}) } });
  if (error) throw error;
  const a = { id: data.user.id, client: client() }; accounts.push(a);
  if (confirmed) { const login = await a.client.auth.signInWithPassword({ email,password }); if (login.error) throw login.error; }
  return a;
}
async function photoRequest(account: Account | null, body: object | FormData) {
  const token = account ? (await account.client.auth.getSession()).data.session?.access_token : status.ANON_KEY;
  return fetch(`${url}/functions/v1/media`, { signal: AbortSignal.timeout(45000), method:'POST', headers: { apikey:key, Authorization:`Bearer ${token}`, ...(body instanceof FormData ? {} : { 'Content-Type':'application/json' }) }, body: body instanceof FormData ? body : JSON.stringify(body) });
}
async function upload(account: Account, id: string, bytes = photoBytes, mime = 'image/png') {
  const form = new FormData(); form.set('listing_id',id); form.set('file',new Blob([new Uint8Array(bytes)], { type:mime }),'photo.png');
  return photoRequest(account, form);
}
beforeAll(async () => {
  owner=await account('owner');ownerB=await account('owner');student=await account('student');studentB=await account('student');unverified=await account('student',false);
  const require = createRequire(import.meta.url);
  await initializeImageMagick(new Uint8Array(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm'))));
  photoBytes=ImageMagick.read(MagickColors.Red,100,60,(image)=>image.write(MagickFormat.Png,(bytes)=>new Uint8Array(bytes)));
  act(owner);
  const hidden = await listings.create({ title:'Fictional private-price room', property_type:'room',address:'Synthetic address',price_amount:190000,price_visible:false,latitude:10,longitude:120,area:'Test area' });
  hiddenId=hidden.id;
  const response=await upload(owner,hiddenId);
  const payload=await response.json();
  if (!response.ok) throw new Error(`Media fixture failed: ${JSON.stringify(payload)}`);
  photoId=payload.id;
  await listings.publish(hiddenId);
  const visible=await listings.create({ title:'Fictional visible-price apartment',property_type:'apartment',address:'Synthetic address',price_amount:250000,price_visible:true,latitude:10,longitude:120 });
  visibleId=visible.id;
  const r=await upload(owner,visibleId);if(!r.ok) throw new Error(`Media fixture failed: ${JSON.stringify(await r.json())}`);
  await listings.publish(visibleId);
  sql(`INSERT INTO app_private.campuses VALUES('${campusId}','Synthetic test reference',10,120);`);
},120000);
afterAll(async () => {
  // Only remove data belonging to these newly created fixture IDs.
  const ids=accounts.map(a=>`'${a.id}'`).join(',');
  if (ids) {
    sql(`DELETE FROM app_private.inquiries WHERE student_id IN (${ids}) OR listing_id IN (SELECT id FROM app_private.listings WHERE owner_id IN (${ids})); DELETE FROM app_private.saved_listings WHERE student_id IN (${ids}); DELETE FROM app_private.listings WHERE owner_id IN (${ids});`);
    for(const a of accounts) await admin.auth.admin.deleteUser(a.id);
  }
  if (hiddenId || visibleId) sql(`DELETE FROM app_private.photo_cleanup WHERE listing_id IN ('${hiddenId ?? '00000000-0000-0000-0000-000000000000'}','${visibleId ?? '00000000-0000-0000-0000-000000000000'}')`);
  sql(`DELETE FROM app_private.campuses WHERE id='${campusId}'; DELETE FROM app_private.semesters WHERE id='${semesterId}';`);
  const { data }=await admin.storage.from('listing-photos').list(hiddenId ?? 'none');
  if(data?.length)await admin.storage.from('listing-photos').remove(data.map(x=>`${hiddenId}/${x.name}`));
  const { data: visibleFiles }=await admin.storage.from('listing-photos').list(visibleId ?? 'none');
  if(visibleFiles?.length)await admin.storage.from('listing-photos').remove(visibleFiles.map(x=>`${visibleId}/${x.name}`));
});

describe('Supabase backend FR1–FR14 / NFR4–NFR8', () => {
  it('allows guest discovery but omits private prices and owner contacts at every read level', async () => {
    act(guest); const page=await listings.list();
    expect(page.items.some(x=>x.id===hiddenId)).toBe(true);
    expect(page.items.find(x=>x.id===hiddenId)).not.toHaveProperty('price_amount');
    const detail=await listings.get(hiddenId);expect(detail).not.toHaveProperty('owner_contact');expect(detail).not.toHaveProperty('price_amount');
    act(student);const loggedIn=await listings.get(hiddenId);expect(loggedIn.owner_contact?.contact_number).toBe('09000000000');expect(loggedIn).not.toHaveProperty('price_amount');
    act(ownerB);expect(await listings.get(hiddenId)).not.toHaveProperty('price_amount');
    act(owner);expect((await listings.own()).items.find(x=>x.id===hiddenId)?.price_amount).toBe(190000);
  });
  it('searches and combines price, type, and amenity filters without private-price inference', async () => {
    act(student);const amenities=await listings.amenities();const wifi=amenities.find(x=>x.name==='Wi-Fi')!;
    act(owner);await listings.update(visibleId,{ amenity_ids:[wifi.id] });act(student);
    const result=await listings.list({q:'Fictional',type:'apartment',min_price:200000,max_price:300000,amenities:['Wi-Fi']});
    expect(result.items.map(x=>x.id)).toEqual([visibleId]);
    expect((await listings.list({min_price:100000})).items.some(x=>x.id===hiddenId)).toBe(false);
    await expect(listings.list({page_size:51})).rejects.toMatchObject({error:{code:'INVALID_INPUT'}});
  });
  it('denies raw tables, private schemas, privileged media RPCs, and unauthenticated writes', async () => {
    const raw=await fetch(`${url}/rest/v1/listings?select=*`,{headers:{apikey:key}});expect(raw.ok).toBe(false);
    const privateSchema=await fetch(`${url}/rest/v1/listings?select=*`,{headers:{apikey:key,'Accept-Profile':'app_private'}});expect(privateSchema.ok).toBe(false);
    const secretRpc=await guest.rpc('tinir_media',{operation:'read',actor_id:owner.id,args:{id:photoId}});expect(secretRpc.error).not.toBeNull();
    act(guest);await expect(inquiries.send(hiddenId,'interest')).rejects.toBeDefined();
    const rls=sql("SELECT count(*) FROM pg_tables WHERE schemaname='app_private' AND NOT rowsecurity");expect(rls).toBe('0');
    expect(sql("SELECT has_schema_privilege('authenticated','app_private','USAGE')")).toBe('f');
  });
  it('denies wrong roles, other owners, identity overrides, and unverified accounts', async () => {
    act(student);await expect(listings.create({title:'Bad',property_type:'room',address:'Bad'})).rejects.toMatchObject({error:{code:'FORBIDDEN'}});
    act(ownerB);await expect(listings.update(hiddenId,{title:'Hijacked'})).rejects.toMatchObject({error:{code:'NOT_FOUND'}});
    act(owner);const override=await owner.client.rpc('tinir_write',{operation:'update_listing',args:{id:hiddenId,owner_id:ownerB.id}});expect(override.data).toMatchObject({error:{code:'INVALID_INPUT'}});
    // Simulate a previously issued token on a now-unverified identity: checking JWT presence alone is insufficient.
    const original = sql(`SELECT email_confirmed_at FROM auth.users WHERE id='${studentB.id}'`);
    sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${studentB.id}';`);
    act(studentB);expect((await listings.get(hiddenId)).owner_contact?.contact_number).toBe('09000000000');
    await expect(savedListings.set(hiddenId,true)).rejects.toMatchObject({error:{code:'EMAIL_UNVERIFIED'}});
    sql(`UPDATE auth.users SET email_confirmed_at='${original}' WHERE id='${studentB.id}'`);
  });
  it('keeps roles immutable even when user metadata is edited', async () => {
    await student.client.auth.updateUser({data:{role:'owner'}});act(student);
    expect((await currentProfile()).role).toBe('student');
    await expect(listings.own()).rejects.toMatchObject({error:{code:'FORBIDDEN'}});
    const bad=await admin.auth.admin.createUser({email:`tinir-test-${randomUUID()}@example.test`,password:'Test-password123',email_confirm:true,user_metadata:{role:'admin',full_name:'Bad role'}});
    expect(bad.error).not.toBeNull();
  });
  it('creates verified accounts only after email confirmation, rejects reused tokens and invalid passwords', async () => {
    const email=`tinir-test-${randomUUID()}@example.test`;const password=`Test-${randomUUID()}`;const signupClient=client();
    const signup=await signupClient.auth.signUp({email,password,options:{data:{role:'student',full_name:'Verification fixture'}}});
    expect(signup.error).toBeNull();expect(signup.data.session).toBeNull();
    if(signup.data.user)accounts.push({id:signup.data.user.id,client:signupClient});
    expect((await signupClient.auth.signInWithPassword({email,password})).error?.code).toBe('email_not_confirmed');
    const link=await admin.auth.admin.generateLink({type:'signup',email,password,options:{data:{role:'student',full_name:'Verification fixture'}}});
    expect(link.error).toBeNull();const hash=link.data.properties!.hashed_token;
    expect((await signupClient.auth.verifyOtp({token_hash:hash,type:'signup'})).error).toBeNull();
    expect((await client().auth.verifyOtp({token_hash:hash,type:'signup'})).error).not.toBeNull();
    expect((await client().auth.signInWithPassword({email,password:'Wrong-password123'})).error?.code).toBe('invalid_credentials');
    await signupClient.auth.signOut();expect((await signupClient.auth.getSession()).data.session).toBeNull();
  });
  it('makes saves idempotent, persistent, and private per student', async () => {
    act(student);await Promise.all([savedListings.set(hiddenId,true),savedListings.set(hiddenId,true)]);
    expect((await savedListings.list()).items.map(x=>x.id)).toEqual([hiddenId]);
    expect((await savedListings.list()).items[0]).not.toHaveProperty('price_amount');
    act(studentB);expect((await savedListings.list()).items).toEqual([]);
    act(student);await savedListings.set(hiddenId,false);await savedListings.set(hiddenId,false);expect((await savedListings.list()).items).toEqual([]);
  });
  it('deduplicates concurrent interests and isolates inquiry history and decisions', async () => {
    act(student);const results=await Promise.all(Array.from({length:4},()=>inquiries.send(hiddenId,'interest')));
    expect(new Set(results.map(x=>x.id)).size).toBe(1);const id=results[0].id;
    await expect(inquiries.send(hiddenId,'question','')).rejects.toMatchObject({error:{code:'INVALID_INPUT'}});
    act(studentB);expect((await inquiries.sent()).items).toEqual([]);
    act(ownerB);expect((await inquiries.received()).items).toEqual([]);await expect(inquiries.update(id,{status:'accepted'})).rejects.toBeDefined();
    act(owner);await inquiries.update(id,{mark_read:true});expect((await inquiries.received()).items[0].status).toBe('pending');
    await inquiries.update(id,{status:'accepted'});act(student);expect((await inquiries.sent()).items[0].status).toBe('accepted');
    await expect(inquiries.update(id,{status:'rejected'})).rejects.toMatchObject({error:{code:'FORBIDDEN'}});
    act(owner);await expect(inquiries.update(id,{status:'rejected'})).rejects.toMatchObject({error:{code:'INVALID_INPUT'}});
    await inquiries.update(id,{status:'pending'});expect((await inquiries.received()).items[0].status).toBe('pending');
  });
  it('computes labeled straight-line distances and rejects invalid coordinates', async () => {
    act(student);expect(await listings.distance(hiddenId,campusId)).toMatchObject({distance_km:0,method:'straight_line'});
    expect(await listings.distance(hiddenId,randomUUID())).toMatchObject({distance_km:null,reason:'CAMPUS_NOT_CONFIGURED'});
    expect(Number(sql('SELECT app_private.distance_km(0,0,0,1)'))).toBeCloseTo(111.19,1);
    act(owner);await expect(listings.update(hiddenId,{latitude:91})).rejects.toMatchObject({error:{code:'INVALID_INPUT'}});
  });
  it('generates reminders once per semester and permits only the owning owner to reconfirm', async () => {
    sql(`INSERT INTO app_private.semesters VALUES('${semesterId}',now()-interval '1 day',now()+interval '10 days'); UPDATE app_private.listings SET last_confirmed_at=now()-interval '2 days' WHERE id='${hiddenId}'; SELECT app_private.generate_reminders(); SELECT app_private.generate_reminders();`);
    act(owner);const pending=(await reminders.list()).items;expect(pending.filter(x=>x.listing_id===hiddenId)).toHaveLength(1);
    act(ownerB);expect((await reminders.list()).items).toEqual([]);await expect(listings.reconfirm(hiddenId)).rejects.toBeDefined();
    act(owner);await listings.reconfirm(hiddenId);sql('SELECT app_private.generate_reminders()');expect((await reminders.list()).items.some(x=>x.listing_id===hiddenId)).toBe(false);
    expect(sql(`SELECT count(*) FROM app_private.listing_reminders WHERE listing_id='${hiddenId}' AND semester_id='${semesterId}'`)).toBe('1');
  });
  it('restores a backup containing synthetic profiles, listings, inquiries, and a bookmark', async () => {
    act(student);await savedListings.set(hiddenId,true);
    const options={encoding:'utf8' as const,stdio:'pipe' as const,timeout:30000};
    execFileSync('node',['scripts/backend/backup.mjs','dump'],options);
    const result=execFileSync('node',['scripts/backend/backup.mjs','verify'],options);
    expect(result).toContain('counts match the backup');
    expect(Number(sql('SELECT count(*) FROM app_private.listings'))).toBeGreaterThan(0);
    await savedListings.set(hiddenId,false);
  },60000);
  it('serves only processed media and rejects upload bypasses, forged MIME types, and foreign owners', async () => {
    const read=await photoRequest(null,{operation:'read',id:photoId});const signed=await read.json();expect(read.ok).toBe(true);
    const download=await fetch(new URL(signed.url,url));expect(download.headers.get('content-type')).toContain('image/webp');
    expect(new TextDecoder().decode(new Uint8Array(await download.arrayBuffer()).slice(8,12))).toBe('WEBP');
    const direct=await student.client.storage.from('listing-photos').upload('bypass.webp',photoBytes,{contentType:'image/webp'});expect(direct.error).not.toBeNull();
    expect((await upload(ownerB,hiddenId)).status).toBe(404);
    expect((await upload(owner,hiddenId,new TextEncoder().encode('not an image'))).status).toBe(400);
    expect((await upload(owner,hiddenId,photoBytes,'image/jpeg')).status).toBe(400);
    expect((await upload(owner,hiddenId,new Uint8Array(5*1024*1024+1))).status).toBe(400);
    const count=Number(sql(`SELECT count(*) FROM app_private.listing_photos WHERE listing_id='${hiddenId}' AND state='pending'`));expect(count).toBe(0);
  },120000);
  it('enforces the ten-photo reservation limit without concurrent oversubscription', async () => {
    sql(`DELETE FROM app_private.request_limits WHERE actor_id='${owner.id}' AND action='upload'`);
    const reserve=()=>admin.rpc('tinir_media',{operation:'reserve',actor_id:owner.id,args:{listing_id:hiddenId}});
    const results=await Promise.all(Array.from({length:11},reserve));
    expect(results.filter(x=>!x.error && !x.data?.error)).toHaveLength(9);
    expect(Number(sql(`SELECT count(*) FROM app_private.listing_photos WHERE listing_id='${hiddenId}'`))).toBe(10);
    for(const r of results)if(r.data && !r.data.error)await admin.rpc('tinir_media',{operation:'cancel',actor_id:owner.id,args:{listing_id:hiddenId,id:r.data.id}});
  });
  it('hides archived listings from discovery, details, saved properties, and future media reads', async () => {
    act(student);await savedListings.set(visibleId,true);act(owner);await listings.archive(visibleId);act(student);
    expect((await listings.list()).items.some(x=>x.id===visibleId)).toBe(false);
    expect((await savedListings.list()).items.some(x=>x.id===visibleId)).toBe(false);
    await expect(listings.get(visibleId)).rejects.toMatchObject({error:{code:'NOT_FOUND'}});
    await expect(savedListings.set(visibleId,true)).rejects.toMatchObject({error:{code:'NOT_FOUND'}});
  });
  it('counts failed direct RPC attempts while rolling back operation writes', async () => {
    const probe = await account('student');
    for (let i = 0; i < 10; i++) {
      const result = await probe.client.rpc('tinir_write', { operation: 'send_inquiry', args: { listing_id: randomUUID(), type: 'interest' } });
      expect(result.data).toMatchObject({ error: { code: 'NOT_FOUND' } });
    }
    expect((await probe.client.rpc('tinir_write', { operation: 'send_inquiry', args: { listing_id: hiddenId, type: 'interest' } })).error?.message).toContain('RATE_LIMITED');
    expect(sql(`SELECT count(*) FROM app_private.inquiries WHERE student_id='${probe.id}'`)).toBe('0');
    const writer = await account('owner');
    const result = await writer.client.rpc('tinir_write', { operation: 'create_listing', args: {title:'Rollback fixture',property_type:'room',address:'Test',latitude:91} });
    expect(result.data).toMatchObject({error:{code:'INVALID_INPUT'}});
    expect(sql(`SELECT count(*) FROM app_private.listings WHERE owner_id='${writer.id}'`)).toBe('0');
    expect(sql(`SELECT sum(count) FROM app_private.request_limits WHERE actor_id='${writer.id}'`)).toBe('1');
  });
  it('queues and retries storage cleanup after an expired upload reservation', async () => {
    sql(`DELETE FROM app_private.request_limits WHERE actor_id='${owner.id}' AND action='upload'`);
    const args = { listing_id: hiddenId };
    const stale = await admin.rpc('tinir_media', { operation:'reserve', actor_id:owner.id, args });
    expect(stale.error).toBeNull();expect(stale.data).not.toHaveProperty('error');
    expect((await admin.storage.from('listing-photos').upload(stale.data.storage_key, photoBytes, {contentType:'image/webp'})).error).toBeNull();
    sql(`UPDATE app_private.listing_photos SET created_at=now()-interval '11 minutes' WHERE id='${stale.data.id}'`);
    const response = await upload(owner, hiddenId);
    expect(response.status).toBe(201);
    expect((await admin.storage.from('listing-photos').download(stale.data.storage_key)).error).not.toBeNull();
    expect(sql(`SELECT count(*) FROM app_private.photo_cleanup WHERE storage_key='${stale.data.storage_key}'`)).toBe('0');
    const added = await response.json();
    await photoRequest(owner, {operation:'delete',listing_id:hiddenId,id:added.id});
  });
  it('rate-limits inquiry mutations on the server', async () => {
    act(studentB);const outcomes=[];
    for(let i=0;i<11;i++)outcomes.push(await inquiries.send(hiddenId,'question','Synthetic rate-limit test').then(()=>true,()=>false));
    expect(outcomes.filter(Boolean)).toHaveLength(10);
  });
});
