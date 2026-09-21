\set ON_ERROR_STOP off
\pset pager off
\pset format unaligned
\pset tuples_only on
reset role;
insert into auth.users(email, raw_user_meta_data) values
 ('a@x.com','{"username":"user_a","display_name":"User A","city":"Cairo","area":"Nasr City","phone_number":"+201000000001"}'),
 ('b@x.com','{"username":"user_b","display_name":"User B","city":"Giza","area":"Dokki","phone_number":"+201000000002"}'),
 ('c@x.com','{"username":"user_c","display_name":"User C","city":"Cairo","area":"Maadi"}');
select id as a from auth.users where email='a@x.com' \gset
select id as b from auth.users where email='b@x.com' \gset
select id as c from auth.users where email='c@x.com' \gset
select id as spider from games where title='Marvel''s Spider-Man 2' and platform='PS5' \gset
select id as fc26 from games where title='EA Sports FC 26' and platform='PS5' \gset
select id as gta from games where title='Grand Theft Auto V' and platform='PS5' \gset

\echo '--- A lists Spider-Man 2 wanting FC26 + GTA V'
set role authenticated; select set_config('request.jwt.claim.sub', :'a', false) \gset
select create_listing(:'spider', 'USED_GOOD', 'disc only', 'Cairo', 'Nasr City', null, array[:'fc26', :'gta']::uuid[]) as la \gset
\echo '--- custom game: add, dedupe (same id ignoring case), invalid title, listing with NO wanted games'
select (add_game('  Some   Rare Game ', 'PS4')).id as g1 \gset
select (add_game('some rare game', 'PS4')).id = :'g1' as same_id_on_repeat;
select add_game('a', 'PS4');
select create_listing(:'g1', 'USED_FAIR', null, 'Cairo', 'Nasr City', null, array[]::uuid[]) as la_open \gset
select count(*) as wanted_rows_for_open_listing from listing_wanted_games where listing_id = :'la_open';
select count(*) as a_active_listings_now from listings where owner_id = :'a' and status = 'ACTIVE';
\echo '--- B lists FC26 wanting Spider-Man 2 ; C lists GTA V'
select set_config('request.jwt.claim.sub', :'b', false) \gset
select create_listing(:'fc26', 'NEW', null, 'Giza', 'Dokki', null, array[:'spider']::uuid[]) as lb \gset
select set_config('request.jwt.claim.sub', :'c', false) \gset
select create_listing(:'gta', 'USED_FAIR', null, 'Cairo', 'Maadi', null, array[:'spider']::uuid[]) as lc \gset

\echo '--- anon sees active listings, but not profile_private / offers'
reset role; set role anon;
select count(*) as anon_active_listings from listings;
select count(*) from profile_private;
reset role;

\echo '--- B messages A about listing A'
set role authenticated; select set_config('request.jwt.claim.sub', :'b', false) \gset
select start_conversation(:'la') as conv \gset
select start_conversation(:'lb');
insert into messages(conversation_id, sender_id, message) values (:'conv', :'b', 'Hi, is Spider-Man 2 still available?');
\echo '--- empty message rejected'
insert into messages(conversation_id, sender_id, message) values (:'conv', :'b', '   ');
\echo '--- spoofed sender rejected'
insert into messages(conversation_id, sender_id, message) values (:'conv', :'a', 'fake');
\echo '--- C cannot read/send in B<->A conversation'
select set_config('request.jwt.claim.sub', :'c', false) \gset
select count(*) as c_sees_messages from messages;
select count(*) as c_sees_convs from conversations;
insert into messages(conversation_id, sender_id, message) values (:'conv', :'c', 'intruder');
\echo '--- A reads and replies'
select set_config('request.jwt.claim.sub', :'a', false) \gset
select count(*) as a_sees_messages from messages;
insert into messages(conversation_id, sender_id, message) values (:'conv', :'a', 'Yes! Send me an offer.');
select unread_message_count() as a_unread;
select mark_conversation_read(:'conv');
select unread_message_count() as a_unread_after;

\echo '--- offers: invalid cases'
select set_config('request.jwt.claim.sub', :'b', false) \gset
select create_offer(:'lb', :'lb');                 -- same listing
select create_offer(:'lb', :'la');                 -- target is own
select create_offer(:'la', :'lc');                 -- offering someone else's listing
select set_config('request.jwt.claim.sub', :'b', false) \gset
select create_offer(:'la', :'lb') as o1 \gset
select create_offer(:'la', :'lb');                 -- duplicate pending
select set_config('request.jwt.claim.sub', :'c', false) \gset
select create_offer(:'la', :'lc') as o2 \gset
\echo '--- direct table writes are blocked'
update listings set status='COMPLETED' where id = :'lc';
insert into offers(listing_id,sender_id,receiver_id,offered_listing_id) values (:'la',:'c',:'a',:'lc');
select status as lc_status from listings where id=:'lc';

\echo '--- B cannot accept (not receiver); B can cancel only own'
select set_config('request.jwt.claim.sub', :'b', false) \gset
select accept_offer(:'o1');
\echo '--- A accepts B offer'
select set_config('request.jwt.claim.sub', :'a', false) \gset
select accept_offer(:'o1');
select l.status as spider_status from listings l where id=:'la';
select l.status as fc26_status from listings l where id=:'lb';
select id = :'o1' as is_o1, status from offers order by created_at;
\echo '--- accept conflicting offer o2 must fail; new offers on reserved listing fail'
select accept_offer(:'o2');
select set_config('request.jwt.claim.sub', :'c', false) \gset
select create_offer(:'la', :'lc');
\echo '--- reject/cancel on non-pending fail'
select cancel_offer(:'o2');

\echo '--- phone privacy'
select set_config('request.jwt.claim.sub', :'b', false) \gset
select get_partner_phone(:'o1') as b_sees_before_share;
select count(*) as b_can_read_others_private from profile_private where id <> :'b';
select share_phone(:'o1');
select set_config('request.jwt.claim.sub', :'a', false) \gset
select get_partner_phone(:'o1') as a_sees_b_phone_after_b_shares;
select get_partner_phone(:'o1') is null as x; 
select set_config('request.jwt.claim.sub', :'b', false) \gset
select get_partner_phone(:'o1') as b_sees_a_phone_before_a_shares;
select set_config('request.jwt.claim.sub', :'c', false) \gset
select get_partner_phone(:'o1') as c_outsider;
select share_phone(:'o1');
\echo '--- C (no phone, outsider) columns: profiles has no phone column'
select count(*) as phone_col_in_profiles from information_schema.columns where table_name='profiles' and column_name like '%phone%';

\echo '--- completion needs both'
select set_config('request.jwt.claim.sub', :'a', false) \gset
select confirm_completion(:'o1') as after_a;
select status as spider_status from listings where id=:'la';
select confirm_completion(:'o1') as a_again;
select set_config('request.jwt.claim.sub', :'b', false) \gset
select confirm_completion(:'o1') as after_b;
select l.status as spider_final from listings l where id=:'la';
select l.status as fc26_final from listings l where id=:'lb';
select status as offer_final from offers where id=:'o1';
\echo '--- C listing still ACTIVE'
select status as c_listing from listings where id=:'lc';
reset role;
