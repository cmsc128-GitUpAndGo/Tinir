-- PR review fixes: FR3-FR5, FR7, FR9-FR11, NFR5-NFR8.
create or replace function app_private.require_actor(p_actor uuid, expected_role text default null, verified boolean default true) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare p app_private.profiles; confirmed timestamptz;
begin
  select * into p from app_private.profiles where id=p_actor;
  if p.id is null then perform app_private.fail('UNAUTHENTICATED','Please log in.'); end if;
  if expected_role is not null and p.role <> expected_role then perform app_private.fail('FORBIDDEN','This action is not available for your role.'); end if;
  select email_confirmed_at into confirmed from auth.users where id=p.id;
  if verified and confirmed is null then perform app_private.fail('EMAIL_UNVERIFIED','Verify your email before continuing.'); end if;
  return p.id;
end $$;

create or replace function app_private.consume_limit(p_actor uuid, p_action text, p_limit integer default 30) returns void
language plpgsql security definer set search_path='' as $$
declare n integer; t timestamptz := date_trunc('minute',now());
begin
  insert into app_private.request_limits values(p_actor,p_action,t,1)
  on conflict on constraint request_limits_pkey do update set count=app_private.request_limits.count+1 returning count into n;
  if n > p_limit then perform app_private.fail('RATE_LIMITED','Too many requests. Try again in a minute.'); end if;
end $$;

create or replace function app_private.actor(expected_role text default null, verified boolean default true) returns uuid
language sql stable security definer set search_path='' as $$
 select app_private.require_actor(auth.uid(),expected_role,verified)
$$;
create or replace function app_private.take_limit(p_action text, p_limit integer default 30) returns void
language sql security definer set search_path='' as $$
 select app_private.consume_limit(auth.uid(),p_action,p_limit)
$$;

-- Catch only the operation subtransaction: its writes roll back, while the hit survives.
-- The public gateways return safe error envelopes so PostgREST commits the counter.
create function app_private.rpc_error(state text, message text) returns jsonb
language plpgsql set search_path='' as $$
begin
 if state='P0001' then
  begin
   if (message::jsonb)->>'code' in ('INVALID_INPUT','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND','EMAIL_UNVERIFIED','RATE_LIMITED') then
    return jsonb_build_object('error',message::jsonb);
   end if;
  exception when others then null;
  end;
 end if;
 if state='23505' then return '{"error":{"code":"CONFLICT","message":"This record conflicts with an existing record."}}'::jsonb; end if;
 if state in ('23514','23502','23503','22P02','22003','22023','22001') then
  return '{"error":{"code":"INVALID_INPUT","message":"Check the submitted fields and try again."}}'::jsonb;
 end if;
 return '{"error":{"code":"REQUEST_FAILED","message":"The operation could not be completed. Try again."}}'::jsonb;
end $$;

-- Preserve object keys even if the worker crashes or Storage removal fails.
create table app_private.photo_cleanup (
 storage_key text primary key, listing_id uuid not null, created_at timestamptz not null default now()
);
alter table app_private.photo_cleanup enable row level security;
revoke all on app_private.photo_cleanup from public,anon,authenticated;
create function app_private.queue_photo_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into app_private.photo_cleanup(storage_key,listing_id) values(old.storage_key,old.listing_id) on conflict do nothing;
 return old;
end $$;
create trigger photo_cleanup after delete on app_private.listing_photos
 for each row execute function app_private.queue_photo_cleanup();

create or replace function public.tinir_write(operation text, args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.actor(); l app_private.listings; inquiry app_private.inquiries; result_id uuid; a uuid;
begin
 perform app_private.take_limit(case when operation='send_inquiry' then 'inquiry' else 'mutation' end,
   case when operation='send_inquiry' then 10 else 30 end);
 begin
 if args is null or jsonb_typeof(args) <> 'object' then perform app_private.fail('INVALID_INPUT','Expected an object.'); end if;
 if args ?| array['owner_id','student_id','role','created_at','updated_at'] then perform app_private.fail('INVALID_INPUT','Identity fields cannot be changed.'); end if;
 if operation in ('create_listing','update_listing','publish_listing','archive_listing','reconfirm_listing') then
  perform app_private.actor('owner');
  if operation='create_listing' then
   insert into app_private.listings(owner_id,title,property_type,address) values(who,args->>'title',args->>'property_type',args->>'address') returning * into l;
  else l:=app_private.owned_listing((args->>'id')::uuid); end if;
  if operation in ('create_listing','update_listing') then
   if l.status='archived' then perform app_private.fail('INVALID_INPUT','Archived listings cannot be edited.'); end if;
   update app_private.listings set
    title=case when args?'title' then args->>'title' else title end,
    property_type=case when args?'property_type' then args->>'property_type' else property_type end,
    address=case when args?'address' then args->>'address' else address end,
    description=case when args?'description' then args->>'description' else description end,
    area=case when args?'area' then args->>'area' else area end,
    house_rules=case when args?'house_rules' then args->>'house_rules' else house_rules end,
    latitude=case when args?'latitude' then (args->>'latitude')::numeric else latitude end,
    longitude=case when args?'longitude' then (args->>'longitude')::numeric else longitude end,
    price_amount=case when args?'price_amount' then (args->>'price_amount')::integer else price_amount end,
    price_visible=case when args?'price_visible' then (args->>'price_visible')::boolean else price_visible end,
    price_period=case when args?'price_period' then args->>'price_period' else price_period end,
    available_slots=case when args?'available_slots' then (args->>'available_slots')::integer else available_slots end,
    availability_status=case when args?'availability_status' then args->>'availability_status' else availability_status end
    where id=l.id returning * into l;
   if args?'amenity_ids' then
    delete from app_private.listing_amenities where listing_id=l.id;
    for a in select value::uuid from jsonb_array_elements_text(args->'amenity_ids') loop
      insert into app_private.listing_amenities values(l.id,a) on conflict do nothing;
    end loop;
   end if;
  elsif operation='publish_listing' then
   if l.status <> 'draft' then perform app_private.fail('INVALID_INPUT','Only a draft can be published.'); end if;
   if not exists(select 1 from app_private.listing_photos where listing_id=l.id and state='ready') then perform app_private.fail('INVALID_INPUT','Upload at least one photo before publishing.'); end if;
   update app_private.listings set status='published',last_confirmed_at=now() where id=l.id returning * into l;
  elsif operation='archive_listing' then
   update app_private.listings set status='archived' where id=l.id returning * into l;
  elsif operation='reconfirm_listing' then
   if l.status<>'published' then perform app_private.fail('INVALID_INPUT','Only a published listing can be reconfirmed.'); end if;
   update app_private.listings set last_confirmed_at=now() where id=l.id returning * into l;
   update app_private.listing_reminders set dismissed_at=now() where listing_id=l.id and dismissed_at is null;
  end if;
  return app_private.listing_json(l,true);
 elsif operation='send_inquiry' then
  perform app_private.actor('student');
  select * into l from app_private.listings where id=(args->>'listing_id')::uuid and status='published' for share;
  if l.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
  -- Serialize duplicate interest requests per user; second retry returns the existing record.
  perform pg_advisory_xact_lock(hashtextextended(who::text,0));
  if args->>'type'='interest' then
   select id into result_id from app_private.inquiries where listing_id=l.id and student_id=who and type='interest' and status='pending';
   if result_id is not null then return jsonb_build_object('id',result_id); end if;
  end if;
  insert into app_private.inquiries(listing_id,student_id,type,message) values(l.id,who,args->>'type',args->>'message') returning id into result_id;
  return jsonb_build_object('id',result_id);
 elsif operation='update_inquiry' then
  perform app_private.actor('owner');
  select * into inquiry from app_private.inquiries where id=(args->>'id')::uuid for update;
  if inquiry.id is null then perform app_private.fail('NOT_FOUND','Inquiry not found.'); end if;
  l:=app_private.owned_listing(inquiry.listing_id);
  if args?'status' then
   if args->>'status' not in ('pending','accepted','rejected') or args->>'status' is null then perform app_private.fail('INVALID_INPUT','Invalid decision.'); end if;
   if inquiry.status<>'pending' and args->>'status'<>inquiry.status and args->>'status'<>'pending' then perform app_private.fail('INVALID_INPUT','Return the decision to Pending before changing it.'); end if;
  end if;
  update app_private.inquiries set status=coalesce(args->>'status',status),
   status_updated_at=case when args?'status' then now() else status_updated_at end,
   read_at=case when coalesce((args->>'mark_read')::boolean,false) then coalesce(read_at,now()) else read_at end
   where id=inquiry.id returning * into inquiry;
  return to_jsonb(inquiry);
 elsif operation='save_listing' then
  perform app_private.actor('student');
  if coalesce((args->>'saved')::boolean,true) then
   perform 1 from app_private.listings where id=(args->>'id')::uuid and status='published' for share;
   if not found then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
   insert into app_private.saved_listings values(who,(args->>'id')::uuid,now()) on conflict do nothing;
  else delete from app_private.saved_listings where student_id=who and listing_id=(args->>'id')::uuid; end if;
  return jsonb_build_object('saved',coalesce((args->>'saved')::boolean,true));
 else perform app_private.fail('INVALID_INPUT','Unknown write operation.'); end if;
 exception when others then return app_private.rpc_error(SQLSTATE,SQLERRM);
 end;
end $$;

create or replace function public.tinir_media(operation text, actor_id uuid, args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l app_private.listings; photo app_private.listing_photos; photo_id uuid; slot smallint;
begin
 if operation='read' then
  select p.* into photo from app_private.listing_photos p join app_private.listings x on x.id=p.listing_id
   where p.id=(args->>'id')::uuid and p.state='ready' and (x.status='published' or x.owner_id=actor_id);
  if photo.id is null then perform app_private.fail('NOT_FOUND','Photo not found.'); end if;
  return jsonb_build_object('storage_key',photo.storage_key);
 end if;
 perform app_private.require_actor(actor_id,'owner');
 if operation='reserve' then perform app_private.consume_limit(actor_id,'upload',10); end if;
 begin
 select * into l from app_private.listings where id=(args->>'listing_id')::uuid and owner_id=actor_id for update;
 if l.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
 if operation='cleanup' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
   select storage_key from app_private.photo_cleanup where listing_id=l.id order by created_at,storage_key limit 50
  ) x),'[]'::jsonb);
 elsif operation='cleanup_done' then
  delete from app_private.photo_cleanup where listing_id=l.id and storage_key in (select jsonb_array_elements_text(args->'storage_keys'));
  return jsonb_build_object('cleaned',true);
 elsif operation='reserve' then
  if l.status='archived' then perform app_private.fail('INVALID_INPUT','Archived listings cannot receive photos.'); end if;
  -- Deletion queues expired object keys durably for retryable Storage cleanup.
  delete from app_private.listing_photos where listing_id=l.id and state='pending' and created_at<now()-interval '10 minutes';
  select n::smallint into slot from generate_series(0,9) n where not exists(select 1 from app_private.listing_photos where listing_id=l.id and sort_order=n) order by n limit 1;
  if slot is null then perform app_private.fail('INVALID_INPUT','A listing can have at most 10 photos.'); end if;
  photo_id:=gen_random_uuid();
  insert into app_private.listing_photos(id,listing_id,storage_key,sort_order) values(photo_id,l.id,l.id::text||'/'||photo_id::text||'.webp',slot) returning * into photo;
 elsif operation in ('finalize','cancel','delete') then
  select * into photo from app_private.listing_photos where id=(args->>'id')::uuid and listing_id=l.id for update;
  if photo.id is null then perform app_private.fail('NOT_FOUND','Photo not found.'); end if;
  if operation='finalize' then
   if l.status='archived' then perform app_private.fail('INVALID_INPUT','Listing was archived during upload.'); end if;
   update app_private.listing_photos set state='ready' where id=photo.id;
   update app_private.listings set updated_at=now() where id=l.id;
  else
   if photo.state='ready' and l.status='published' and (select count(*) from app_private.listing_photos where listing_id=l.id and state='ready')<=1 then
     perform app_private.fail('INVALID_INPUT','A published listing needs at least one photo.'); end if;
   delete from app_private.listing_photos where id=photo.id;
   update app_private.listings set updated_at=now() where id=l.id;
  end if;
 else perform app_private.fail('INVALID_INPUT','Unknown media operation.'); end if;
 return to_jsonb(photo);
 exception when others then return app_private.rpc_error(SQLSTATE,SQLERRM);
 end;
end $$;

revoke all on all functions in schema app_private from public,anon,authenticated;
