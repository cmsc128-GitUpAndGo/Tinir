-- FR4 / NFR4 / NFR5: a logged-out session stops working on the server at once.
-- Auth deletes the session row on logout, but an issued access token stays valid until it expires.
-- Requiring a live session row makes protected RPCs reject that token right after logout.

create function app_private.session_user() returns uuid
language sql stable security definer set search_path='' as $$
 select s.user_id from auth.sessions s
 where s.id = nullif(auth.jwt()->>'session_id','')::uuid
   and s.user_id = auth.uid()
   and (s.not_after is null or s.not_after > now())
$$;

create or replace function app_private.actor(expected_role text default null, verified boolean default true) returns uuid
language sql stable security definer set search_path='' as $$
 select app_private.require_actor(app_private.session_user(),expected_role,verified)
$$;
create or replace function app_private.take_limit(p_action text, p_limit integer default 30) returns void
language sql security definer set search_path='' as $$
 select app_private.consume_limit(app_private.session_user(),p_action,p_limit)
$$;

-- Owner contacts need a live session as well as a token (NFR8).
create or replace function app_private.listing_json(l app_private.listings, management boolean default false, detail boolean default false)
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
 if detail and app_private.session_user() is not null then
   select jsonb_build_object('full_name',p.full_name,'contact_number',p.contact_number,'email',u.email) into contact
     from app_private.profiles p join auth.users u on u.id=p.id where p.id=l.owner_id;
   result:=result||jsonb_build_object('owner_contact',contact);
 end if;
 return result;
end $$;

revoke all on function app_private.session_user() from public,anon,authenticated;
