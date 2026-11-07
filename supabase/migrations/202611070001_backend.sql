-- Tinir FR1-FR14, NFR4-NFR8. Only guarded RPCs are exposed to clients.
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','owner')),
  full_name varchar(120) not null check (length(trim(full_name)) > 0),
  contact_number varchar(20), college_program varchar(120),
  created_at timestamptz not null default now(),
  check (role <> 'owner' or length(trim(contact_number)) > 0 and contact_number is not null)
);
create table app_private.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_private.profiles(id),
  title varchar(120) not null check (length(trim(title)) > 0),
  property_type text not null check (property_type in ('bedspace','room','apartment')),
  description text not null default '' check (length(description) <= 10000),
  address varchar(255) not null check (length(trim(address)) > 0),
  area varchar(100) not null default '', house_rules text not null default '' check (length(house_rules) <= 10000),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  price_amount integer check (price_amount > 0), price_visible boolean not null default false,
  price_period text not null default 'monthly' check (price_period in ('monthly','semester')),
  available_slots integer check (available_slots >= 0),
  availability_status text not null default 'available' check (availability_status in ('available','full')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  last_confirmed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (not price_visible or price_amount is not null),
  check (status <> 'published' or latitude is not null and longitude is not null)
);
create index listings_discovery_idx on app_private.listings(status,property_type,price_amount);
create index listings_owner_idx on app_private.listings(owner_id);
create table app_private.amenities (id uuid primary key default gen_random_uuid(), name varchar(80) not null unique);
create table app_private.listing_amenities (
  listing_id uuid references app_private.listings(id) on delete cascade,
  amenity_id uuid references app_private.amenities(id), primary key(listing_id,amenity_id)
);
create table app_private.listing_photos (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references app_private.listings(id) on delete cascade,
  storage_key text not null unique, sort_order smallint not null check (sort_order between 0 and 9),
  state text not null default 'pending' check (state in ('pending','ready')),
  created_at timestamptz not null default now(), unique(listing_id,sort_order)
);
create table app_private.inquiries (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references app_private.listings(id),
  student_id uuid not null references app_private.profiles(id), type text not null check(type in ('interest','question')),
  message text check(length(message) <= 4000), status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  read_at timestamptz, status_updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  check(type <> 'question' or message is not null and length(trim(message)) > 0)
);
create unique index one_pending_interest on app_private.inquiries(listing_id,student_id) where type='interest' and status='pending';
create index inquiries_student_idx on app_private.inquiries(student_id,created_at desc);
create index inquiries_listing_idx on app_private.inquiries(listing_id,status,created_at desc);
create table app_private.saved_listings (
  student_id uuid references app_private.profiles(id) on delete cascade,
  listing_id uuid references app_private.listings(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(student_id,listing_id)
);
create table app_private.campuses (
  id uuid primary key default gen_random_uuid(), name varchar(120) not null,
  latitude numeric(9,6) not null check(latitude between -90 and 90),
  longitude numeric(9,6) not null check(longitude between -180 and 180)
);
create table app_private.semesters (
  id text primary key check(length(id) between 1 and 40), starts_at timestamptz not null, ends_at timestamptz not null,
  check(ends_at > starts_at)
);
create table app_private.listing_reminders (
  listing_id uuid references app_private.listings(id) on delete cascade,
  semester_id text references app_private.semesters(id), created_at timestamptz not null default now(),
  dismissed_at timestamptz, primary key(listing_id,semester_id)
);
create table app_private.request_limits (
  actor_id uuid not null references auth.users(id) on delete cascade, action text not null,
  window_start timestamptz not null, count integer not null, primary key(actor_id,action,window_start)
);

create function app_private.fail(code text, message text) returns void language plpgsql set search_path='' as $$
begin raise exception using errcode='P0001', message=jsonb_build_object('code',code,'message',message)::text; end $$;

create function app_private.actor(expected_role text default null, verified boolean default true) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare p app_private.profiles; confirmed timestamptz;
begin
  select * into p from app_private.profiles where id=auth.uid();
  if p.id is null then perform app_private.fail('UNAUTHENTICATED','Please log in.'); end if;
  if expected_role is not null and p.role <> expected_role then perform app_private.fail('FORBIDDEN','This action is not available for your role.'); end if;
  select email_confirmed_at into confirmed from auth.users where id=p.id;
  if verified and confirmed is null then perform app_private.fail('EMAIL_UNVERIFIED','Verify your email before continuing.'); end if;
  return p.id;
end $$;

create function app_private.take_limit(p_action text, p_limit integer default 30) returns void
language plpgsql security definer set search_path='' as $$
declare n integer; t timestamptz := date_trunc('minute',now());
begin
  insert into app_private.request_limits values(auth.uid(),p_action,t,1)
  on conflict on constraint request_limits_pkey do update set count=app_private.request_limits.count+1 returning count into n;
  if n > p_limit then perform app_private.fail('RATE_LIMITED','Too many requests. Try again in a minute.'); end if;
end $$;

create function app_private.owned_listing(p_id uuid) returns app_private.listings
language plpgsql security definer set search_path='' as $$
declare l app_private.listings; who uuid := app_private.actor('owner');
begin
  select * into l from app_private.listings where id=p_id and owner_id=who for update;
  if l.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
  return l;
end $$;

create function app_private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Copy the role once at signup. Subsequent user_metadata edits do not grant roles.
  insert into app_private.profiles(id,role,full_name,contact_number,college_program)
  values(new.id,new.raw_user_meta_data->>'role',new.raw_user_meta_data->>'full_name',
    nullif(trim(new.raw_user_meta_data->>'contact_number'),''),nullif(trim(new.raw_user_meta_data->>'college_program'),''));
  return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function app_private.new_profile();

create function app_private.touch_listing() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create trigger listing_timestamp before update on app_private.listings for each row execute function app_private.touch_listing();

create function app_private.listing_json(l app_private.listings, management boolean default false, detail boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; contact jsonb;
begin
 result := jsonb_build_object('id',l.id,'title',l.title,'property_type',l.property_type,'area',l.area,
   'price_visible',l.price_visible,'price_period',l.price_period,'availability_status',l.availability_status,
   'updated_at',l.updated_at,'created_at',l.created_at,
   'amenities',coalesce((select jsonb_agg(a.name order by a.name) from app_private.listing_amenities la join app_private.amenities a on a.id=la.amenity_id where la.listing_id=l.id),'[]'::jsonb),
   'photos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sort_order',p.sort_order) order by p.sort_order) from app_private.listing_photos p where p.listing_id=l.id and state='ready'),'[]'::jsonb));
 if l.price_visible or management then result:=result||jsonb_build_object('price_amount',l.price_amount); end if;
 if detail or management then
   result:=result||jsonb_build_object('address',l.address,'description',l.description,'house_rules',l.house_rules,
    'latitude',l.latitude,'longitude',l.longitude,'available_slots',l.available_slots,'last_confirmed_at',l.last_confirmed_at);
 end if;
 if management then result:=result||jsonb_build_object('status',l.status,'owner_id',l.owner_id); end if;
 if detail and auth.uid() is not null then
   select jsonb_build_object('full_name',p.full_name,'contact_number',p.contact_number,'email',u.email) into contact
     from app_private.profiles p join auth.users u on u.id=p.id where p.id=l.owner_id;
   result:=result||jsonb_build_object('owner_contact',contact);
 end if;
 return result;
end $$;

create function app_private.distance_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric) returns numeric
language sql immutable set search_path='' as $$
 select round((6371*2*asin(sqrt(least(1.0,greatest(0.0,
   power(sin(radians((lat2-lat1)::double precision)/2),2)+cos(radians(lat1::double precision))*cos(radians(lat2::double precision))*power(sin(radians((lon2-lon1)::double precision)/2),2))))))::numeric,2)
$$;

create function public.tinir_read(operation text, args jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare who uuid; record_listing app_private.listings; result jsonb; campus app_private.campuses;
 page_no integer:=coalesce((args->>'page')::integer,1); page_size integer:=coalesce((args->>'page_size')::integer,20);
 min_price integer:=(args->>'min_price')::integer; max_price integer:=(args->>'max_price')::integer;
begin
 if args is null or jsonb_typeof(args) <> 'object' then perform app_private.fail('INVALID_INPUT','Expected an object.'); end if;
 if page_no < 1 or page_no > 100000 or page_size < 1 or page_size > 50 then perform app_private.fail('INVALID_INPUT','Invalid pagination.'); end if;
 if min_price < 0 or max_price < 0 or min_price > max_price or length(coalesce(args->>'q','')) > 200 then perform app_private.fail('INVALID_INPUT','Invalid search filters.'); end if;
 if operation='amenities' then
   return coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from app_private.amenities a),'[]'::jsonb);
 elsif operation='campuses' then
   return coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from app_private.campuses c),'[]'::jsonb);
 elsif operation='listings' then
   select coalesce(jsonb_agg(app_private.listing_json(x)),'[]'::jsonb) into result from (
    select * from app_private.listings l where l.status='published'
     and (args->>'type' is null or l.property_type=args->>'type')
     and (min_price is null or l.price_visible and l.price_amount>=min_price)
     and (max_price is null or l.price_visible and l.price_amount<=max_price)
     and (nullif(args->>'q','') is null or position(lower(args->>'q') in lower(concat_ws(' ',l.title,l.address,l.area))) > 0)
     and not exists(select 1 from jsonb_array_elements_text(coalesce(args->'amenities','[]'::jsonb)) wanted(name)
       where not exists(select 1 from app_private.listing_amenities la join app_private.amenities a on a.id=la.amenity_id where la.listing_id=l.id and a.name=wanted.name))
    order by l.created_at desc,l.id limit page_size offset (page_no-1)*page_size
   ) x;
   return jsonb_build_object('items',result,'page',page_no,'page_size',page_size);
 elsif operation='listing' then
   select * into record_listing from app_private.listings where id=(args->>'id')::uuid and status='published';
   if record_listing.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
   return app_private.listing_json(record_listing,false,true);
 elsif operation='profile' then
   who:=app_private.actor(null,false);
   return (select to_jsonb(p)||jsonb_build_object('email',u.email,'email_verified',u.email_confirmed_at is not null)
     from app_private.profiles p join auth.users u on u.id=p.id where p.id=who);
 end if;
 who:=app_private.actor();
 if operation='owner_listings' then
   perform app_private.actor('owner');
   select coalesce(jsonb_agg(app_private.listing_json(x,true)),'[]'::jsonb) into result from (
     select * from app_private.listings where owner_id=who order by created_at desc,id limit page_size offset (page_no-1)*page_size) x;
 elsif operation='saved_listings' then
   perform app_private.actor('student');
   select coalesce(jsonb_agg(app_private.listing_json(x)),'[]'::jsonb) into result from (
     select l.* from app_private.listings l join app_private.saved_listings s on s.listing_id=l.id
     where s.student_id=who and l.status='published' order by s.created_at desc,l.id limit page_size offset (page_no-1)*page_size) x;
 elsif operation in ('student_inquiries','owner_inquiries') then
   perform app_private.actor(case when operation='student_inquiries' then 'student' else 'owner' end);
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
    select i.*,l.title as listing_title from app_private.inquiries i join app_private.listings l on l.id=i.listing_id
     where (case when operation='student_inquiries' then i.student_id=who else l.owner_id=who end)
      and (args->>'listing_id' is null or i.listing_id=(args->>'listing_id')::uuid)
      and (args->>'status' is null or i.status=args->>'status')
    order by i.created_at desc,i.id limit page_size offset (page_no-1)*page_size) x;
 elsif operation='reminders' then
   perform app_private.actor('owner');
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
    select r.*,l.title from app_private.listing_reminders r join app_private.listings l on l.id=r.listing_id
     where l.owner_id=who and l.status='published' and r.dismissed_at is null
      and exists(select 1 from app_private.semesters s where s.id=r.semester_id and now()>=s.starts_at and now()<s.ends_at)
    order by r.created_at desc,r.listing_id limit page_size offset (page_no-1)*page_size) x;
 elsif operation='distance' then
   perform app_private.actor('student');
   select * into record_listing from app_private.listings where id=(args->>'id')::uuid and status='published';
   if record_listing.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
   select * into campus from app_private.campuses where id=(args->>'campus_id')::uuid;
   if campus.id is null then return jsonb_build_object('distance_km',null,'reason','CAMPUS_NOT_CONFIGURED','method','straight_line'); end if;
   return jsonb_build_object('campus_id',campus.id,'distance_km',app_private.distance_km(record_listing.latitude,record_listing.longitude,campus.latitude,campus.longitude),'method','straight_line');
 else perform app_private.fail('INVALID_INPUT','Unknown read operation.');
 end if;
 return jsonb_build_object('items',result,'page',page_no,'page_size',page_size);
end $$;

create function public.tinir_write(operation text, args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.actor(); l app_private.listings; inquiry app_private.inquiries; result_id uuid; a uuid;
begin
 if args is null or jsonb_typeof(args) <> 'object' then perform app_private.fail('INVALID_INPUT','Expected an object.'); end if;
 if args ?| array['owner_id','student_id','role','created_at','updated_at'] then perform app_private.fail('INVALID_INPUT','Identity fields cannot be changed.'); end if;
 if operation in ('create_listing','update_listing','publish_listing','archive_listing','reconfirm_listing') then
  perform app_private.actor('owner'); perform app_private.take_limit('listing');
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
  perform app_private.take_limit('inquiry',10);
  insert into app_private.inquiries(listing_id,student_id,type,message) values(l.id,who,args->>'type',args->>'message') returning id into result_id;
  return jsonb_build_object('id',result_id);
 elsif operation='update_inquiry' then
  perform app_private.actor('owner'); perform app_private.take_limit('inquiry_decision');
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
  perform app_private.actor('student'); perform app_private.take_limit('bookmark');
  if coalesce((args->>'saved')::boolean,true) then
   perform 1 from app_private.listings where id=(args->>'id')::uuid and status='published' for share;
   if not found then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
   insert into app_private.saved_listings values(who,(args->>'id')::uuid,now()) on conflict do nothing;
  else delete from app_private.saved_listings where student_id=who and listing_id=(args->>'id')::uuid; end if;
  return jsonb_build_object('saved',coalesce((args->>'saved')::boolean,true));
 else perform app_private.fail('INVALID_INPUT','Unknown write operation.'); end if;
end $$;

-- Only the media Edge Function (service key) may reserve/finalize processed photos.
-- It passes the user ID returned by Auth.getUser(), never a caller-supplied ID.
create function public.tinir_media(operation text, actor_id uuid, args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l app_private.listings; photo app_private.listing_photos; photo_id uuid; slot smallint;
begin
 if operation='read' then
  select p.* into photo from app_private.listing_photos p join app_private.listings x on x.id=p.listing_id
   where p.id=(args->>'id')::uuid and p.state='ready' and (x.status='published' or x.owner_id=actor_id);
  if photo.id is null then perform app_private.fail('NOT_FOUND','Photo not found.'); end if;
  return jsonb_build_object('storage_key',photo.storage_key);
 end if;
 perform 1 from app_private.profiles p join auth.users u on u.id=p.id
  where p.id=actor_id and p.role='owner' and u.email_confirmed_at is not null;
 if not found then perform app_private.fail('FORBIDDEN','A verified owner account is required.'); end if;
 select * into l from app_private.listings where id=(args->>'listing_id')::uuid and owner_id=actor_id for update;
 if l.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
 if operation='reserve' then
  if l.status='archived' then perform app_private.fail('INVALID_INPUT','Archived listings cannot receive photos.'); end if;
  -- Expired pending reservations can be removed; their objects never become readable.
  delete from app_private.listing_photos where listing_id=l.id and state='pending' and created_at<now()-interval '10 minutes';
  select n::smallint into slot from generate_series(0,9) n where not exists(select 1 from app_private.listing_photos where listing_id=l.id and sort_order=n) order by n limit 1;
  if slot is null then perform app_private.fail('INVALID_INPUT','A listing can have at most 10 photos.'); end if;
  -- Share the same persistent limiter as other requests, with an explicit trusted actor.
  insert into app_private.request_limits values(actor_id,'upload',date_trunc('minute',now()),1)
   on conflict on constraint request_limits_pkey do update set count=app_private.request_limits.count+1;
  if (select count from app_private.request_limits where request_limits.actor_id=tinir_media.actor_id and action='upload' and window_start=date_trunc('minute',now()))>10 then
   perform app_private.fail('RATE_LIMITED','Too many uploads. Try again in a minute.'); end if;
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
end $$;

create function app_private.generate_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into app_private.listing_reminders(listing_id,semester_id)
 select l.id,s.id from app_private.listings l join app_private.semesters s on now()>=s.starts_at and now()<s.ends_at
 where l.status='published' and (l.last_confirmed_at is null or l.last_confirmed_at<s.starts_at) on conflict do nothing;
 get diagnostics n=row_count;
 delete from app_private.request_limits where window_start < now()-interval '1 day';
 return n;
end $$;

-- Deny raw schema/table access and implicit function EXECUTE grants.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='app_private' loop
   execute format('alter table app_private.%I enable row level security',t.tablename);
 end loop;
end $$;
revoke all on all tables in schema app_private from public,anon,authenticated;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.tinir_read(text,jsonb),public.tinir_write(text,jsonb),public.tinir_media(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.tinir_read(text,jsonb) to anon,authenticated;
grant execute on function public.tinir_write(text,jsonb) to authenticated;
grant execute on function public.tinir_media(text,uuid,jsonb) to service_role;
alter default privileges in schema app_private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('listing-photos','listing-photos',false,5242880,array['image/webp']);
-- No storage.objects policies: clients cannot upload/read the bucket directly.
create extension if not exists pg_cron;
select cron.schedule('tinir-semester-reminders','0 * * * *','select app_private.generate_reminders()');
