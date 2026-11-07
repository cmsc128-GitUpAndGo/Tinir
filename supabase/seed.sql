-- Reference data only; never seed real people, credentials, or invented campus coordinates.
insert into app_private.amenities(name) values
 ('Wi-Fi'),('Air conditioning'),('Private bathroom'),('Kitchen'),('Laundry'),('Parking'),
 ('Study area'),('Water included'),('Electricity included'),('CCTV') on conflict(name) do nothing;
-- Synthetic users/listings and campus coordinates live in the isolated integration tests.
