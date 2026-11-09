begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(21);

create temporary table review_fixtures (name text primary key, id uuid default gen_random_uuid());
insert into review_fixtures(name) values('student'),('owner'),('listing');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select id,id::text||'@example.test',now(),jsonb_build_object('role',name,'full_name','Review fixture','contact_number','09000000000')
 from review_fixtures where name in ('student','owner');
-- Protected RPCs require a live Auth session, so each fixture logs in with one.
insert into auth.sessions(id,user_id) select gen_random_uuid(),id from review_fixtures where name in ('student','owner');
create function pg_temp.login_as(fixture text) returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',s.user_id,'session_id',s.id)::text,true)
 from auth.sessions s join review_fixtures f on f.id=s.user_id where f.name=fixture
$$;
select pg_temp.login_as('student');

select is((select count(*) from generate_series(1,10) n where
 public.tinir_write('send_inquiry',jsonb_build_object('listing_id',gen_random_uuid(),'type','interest'))->'error'->>'code'='NOT_FOUND'),10::bigint,
 'Failed direct RPC probes return safe errors');
select is((select sum(count) from app_private.request_limits where actor_id=auth.uid()),10::bigint,'Failed probes consume persistent rate-limit hits');
select throws_ok($$select public.tinir_write('send_inquiry','{}')$$,'P0001','{"code": "RATE_LIMITED", "message": "Too many requests. Try again in a minute."}','Next inquiry attempt is throttled');
select is((select count(*) from app_private.inquiries where student_id=auth.uid()),0::bigint,'Failed inquiry attempts leave no writes');

select pg_temp.login_as('owner');
select is(public.tinir_write('create_listing','{"title":"Rollback fixture","property_type":"room","address":"Test","latitude":91}')->'error'->>'code','INVALID_INPUT','Constraint errors are sanitized');
select is((select count(*) from app_private.listings where owner_id=auth.uid()),0::bigint,'Partial listing creation rolls back');
select is((select sum(count) from app_private.request_limits where actor_id=auth.uid()),1::bigint,'Rollback preserves the attempt counter');
select is(public.tinir_media('reserve',auth.uid(),jsonb_build_object('listing_id',gen_random_uuid()))->'error'->>'code','NOT_FOUND','Media failure returns a safe envelope');
select is((select sum(count) from app_private.request_limits where actor_id=auth.uid() and action='upload'),1::bigint,'Failed media reservation consumes a hit');
select is(app_private.actor('owner'),auth.uid(),'RPC and media share trusted actor checks');
select ok(not has_function_privilege('authenticated','app_private.require_actor(uuid,text,boolean)','EXECUTE'),'Caller cannot choose an actor through the private helper');
select ok(not has_function_privilege('authenticated','app_private.consume_limit(uuid,text,integer)','EXECUTE'),'Caller cannot bypass the private limiter');

insert into app_private.listings(id,owner_id,title,property_type,address)
 select id,auth.uid(),'Cleanup fixture','room','Synthetic address' from review_fixtures where name='listing';
create temporary table review_photos as select public.tinir_media('reserve',auth.uid(),jsonb_build_object('listing_id',id)) as photo from review_fixtures where name='listing';
update app_private.listing_photos set created_at=now()-interval '11 minutes' where id=(select (photo->>'id')::uuid from review_photos);
select public.tinir_media('reserve',auth.uid(),jsonb_build_object('listing_id',id)) from review_fixtures where name='listing';
select is((select count(*) from app_private.photo_cleanup where storage_key=(select photo->>'storage_key' from review_photos)),1::bigint,'Expired reservation queues its storage key');
select is((select count(*) from app_private.listing_photos where id=(select (photo->>'id')::uuid from review_photos)),0::bigint,'Expired reservation frees its slot');
select is(jsonb_array_length(public.tinir_media('cleanup',auth.uid(),jsonb_build_object('listing_id',(select id from review_fixtures where name='listing')))),1,'Cleanup returns durable work');
select is(jsonb_array_length(public.tinir_media('cleanup',auth.uid(),jsonb_build_object('listing_id',(select id from review_fixtures where name='listing')))),1,'Unacknowledged cleanup remains retryable');
select public.tinir_media('cleanup_done',auth.uid(),jsonb_build_object('listing_id',(select id from review_fixtures where name='listing'),'storage_keys',jsonb_build_array((select photo->>'storage_key' from review_photos))));
select is((select count(*) from app_private.photo_cleanup where listing_id=(select id from review_fixtures where name='listing')),0::bigint,'Successful removal can acknowledge cleanup');
select ok(not has_table_privilege('authenticated','app_private.photo_cleanup','SELECT'),'Cleanup keys are private');
-- NFR8 is login-only; verification remains mandatory for protected role actions.
update app_private.listings set latitude=10,longitude=120,status='published' where id=(select id from review_fixtures where name='listing');
select pg_temp.login_as('student');
update auth.users set email_confirmed_at=null where id=auth.uid();
select ok(public.tinir_read('listing',jsonb_build_object('id',(select id from review_fixtures where name='listing'))) ? 'owner_contact','Unverified logged-in users retain documented contact access');
select ok(not (public.tinir_read('listing',jsonb_build_object('id',(select id from review_fixtures where name='listing'))) ? 'price_amount'),'Unverified login never reveals hidden prices');
select throws_ok($$select app_private.actor('student')$$,'P0001','{"code": "EMAIL_UNVERIFIED", "message": "Verify your email before continuing."}','Unverified identity cannot perform protected role actions');
select * from finish();
rollback;
