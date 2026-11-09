begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(9);

-- FR4: an access token only works while its Auth session exists.
create temporary table session_fixtures (name text primary key, id uuid default gen_random_uuid(), session_id uuid default gen_random_uuid());
insert into session_fixtures(name) values('student'),('owner'),('listing');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select id,id::text||'@example.test',now(),jsonb_build_object('role',name,'full_name','Session fixture','contact_number','09000000000')
 from session_fixtures where name in ('student','owner');
insert into auth.sessions(id,user_id) select session_id,id from session_fixtures where name in ('student','owner');
insert into app_private.listings(id,owner_id,title,property_type,address,latitude,longitude,status)
 select l.id,o.id,'Session fixture','room','Synthetic address',10,120,'published'
 from session_fixtures l, session_fixtures o where l.name='listing' and o.name='owner';
create function pg_temp.claims(fixture text, session uuid) returns text language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',f.id,'session_id',session)::text,true) from session_fixtures f where f.name=fixture
$$;
create function pg_temp.listing() returns jsonb language sql as $$
 select public.tinir_read('listing',jsonb_build_object('id',(select id from session_fixtures where name='listing')))
$$;

select pg_temp.claims('student',(select session_id from session_fixtures where name='student'));
select is(app_private.actor('student'),(select id from session_fixtures where name='student'),'A live session passes protected checks');
select ok(pg_temp.listing() ? 'owner_contact','A live session sees owner contacts');

-- Logout deletes the session row; the same token must stop working.
delete from auth.sessions where id=(select session_id from session_fixtures where name='student');
select throws_ok($$select app_private.actor('student')$$,'P0001','{"code": "UNAUTHENTICATED", "message": "Please log in."}','A logged-out token fails protected checks');
select throws_ok($$select public.tinir_read('profile')$$,'P0001','{"code": "UNAUTHENTICATED", "message": "Please log in."}','A logged-out token cannot read the private profile');
select ok(not (pg_temp.listing() ? 'owner_contact'),'A logged-out token no longer sees owner contacts');

-- A token naming another user's session, or no session, is not accepted.
select pg_temp.claims('student',(select session_id from session_fixtures where name='owner'));
select throws_ok($$select app_private.actor()$$,'P0001','{"code": "UNAUTHENTICATED", "message": "Please log in."}','A session belonging to another user is rejected');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from session_fixtures where name='owner'))::text,true);
select throws_ok($$select app_private.actor()$$,'P0001','{"code": "UNAUTHENTICATED", "message": "Please log in."}','A token without a session is rejected');

-- Sessions past their timebox are rejected even if Auth has not cleaned them up yet.
select pg_temp.claims('owner',(select session_id from session_fixtures where name='owner'));
select is(app_private.actor('owner'),(select id from session_fixtures where name='owner'),'The owner session is live');
update auth.sessions set not_after=now()-interval '1 second' where id=(select session_id from session_fixtures where name='owner');
select throws_ok($$select app_private.actor('owner')$$,'P0001','{"code": "UNAUTHENTICATED", "message": "Please log in."}','An expired session is rejected');

select * from finish();
rollback;
