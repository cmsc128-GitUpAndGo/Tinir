-- Read a verified student’s bookmark state without scanning their saved pages.
create or replace function public.tinir_read(operation text, args jsonb default '{}'::jsonb) returns jsonb
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
 elsif operation='saved_listing_status' then
   perform app_private.actor('student');
   select * into record_listing from app_private.listings where id=(args->>'id')::uuid and status='published';
   if record_listing.id is null then perform app_private.fail('NOT_FOUND','Listing not found.'); end if;
   return jsonb_build_object('saved',exists(
     select 1 from app_private.saved_listings where student_id=who and listing_id=record_listing.id
   ));
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
