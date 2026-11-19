-- FR1 / FR6 (#12): the billing period is part of the price, so it is shown only when the price is.
-- Public views drop both the amount and the period for a hidden price; the owner's management view keeps both.

create or replace function app_private.listing_json(l app_private.listings, management boolean default false, detail boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; contact jsonb;
begin
 result := jsonb_build_object('id',l.id,'title',l.title,'property_type',l.property_type,'area',l.area,
   'price_visible',l.price_visible,'availability_status',l.availability_status,
   'updated_at',l.updated_at,'created_at',l.created_at,
   'amenities',coalesce((select jsonb_agg(a.name order by a.name) from app_private.listing_amenities la join app_private.amenities a on a.id=la.amenity_id where la.listing_id=l.id),'[]'::jsonb),
   'photos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sort_order',p.sort_order) order by p.sort_order) from app_private.listing_photos p where p.listing_id=l.id and state='ready'),'[]'::jsonb));
 if l.price_visible or management then
   result:=result||jsonb_build_object('price_amount',l.price_amount,'price_period',l.price_period);
 end if;
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
