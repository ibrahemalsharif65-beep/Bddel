-- =====================================================================
-- Baddel: schema, security (RLS + column privileges) and swap-flow RPCs
-- =====================================================================

-- ---------- enums ----------
create type public.platform_t       as enum ('PS4', 'PS5');
create type public.condition_t      as enum ('NEW', 'USED_LIKE_NEW', 'USED_GOOD', 'USED_FAIR');
create type public.listing_status_t as enum ('ACTIVE', 'SWAP_PENDING', 'COMPLETED', 'CANCELLED');
create type public.offer_status_t   as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- ---------- helpers ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Raises a stable machine-readable error. The UI maps BADDEL:<CODE> to a friendly message.
create or replace function public.baddel_fail(p_code text) returns void
language plpgsql as $$
begin
  raise exception 'BADDEL:%', p_code using errcode = 'P0001';
end $$;

-- ---------- tables ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 50),
  profile_image text,
  city          text not null check (char_length(btrim(city)) > 0),
  area          text not null check (char_length(btrim(area)) > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Private per-user data. Kept out of `profiles` so no public query can ever expose it.
create table public.profile_private (
  id           uuid primary key references public.profiles(id) on delete cascade,
  phone_number text check (phone_number is null or phone_number ~ '^\+?[0-9]{8,15}$'),
  updated_at   timestamptz not null default now()
);

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  platform    public.platform_t not null,
  cover_image text,
  created_at  timestamptz not null default now(),
  unique (title, platform)
);

create table public.listings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  game_id     uuid not null references public.games(id),
  condition   public.condition_t not null,
  description text check (description is null or char_length(description) <= 1000),
  image_url   text,
  city        text not null,
  area        text not null,
  status      public.listing_status_t not null default 'ACTIVE',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_owner_idx          on public.listings (owner_id);
create index listings_game_idx           on public.listings (game_id);

create table public.listing_wanted_games (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  game_id    uuid not null references public.games(id),
  created_at timestamptz not null default now(),
  unique (listing_id, game_id)
);
create index lwg_game_idx on public.listing_wanted_games (game_id);

create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (initiator_id <> owner_id),
  unique (listing_id, initiator_id)
);
create index conversations_owner_idx on public.conversations (owner_id);
create index conversations_initiator_idx on public.conversations (initiator_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  message         text not null check (char_length(btrim(message)) > 0 and char_length(message) <= 2000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index messages_conv_created_idx on public.messages (conversation_id, created_at);

create table public.offers (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references public.listings(id) on delete cascade,  -- target: the game the sender wants
  sender_id             uuid not null references public.profiles(id) on delete cascade,
  receiver_id           uuid not null references public.profiles(id) on delete cascade,
  offered_listing_id    uuid not null references public.listings(id) on delete cascade,  -- the game the sender gives
  status                public.offer_status_t not null default 'PENDING',
  sender_confirmed_at   timestamptz,   -- two-party completion confirmation
  receiver_confirmed_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (sender_id <> receiver_id),
  check (listing_id <> offered_listing_id)
);
create index offers_listing_idx  on public.offers (listing_id);
create index offers_offered_idx  on public.offers (offered_listing_id);
create index offers_sender_idx   on public.offers (sender_id);
create index offers_receiver_idx on public.offers (receiver_id);
create unique index offers_one_pending_per_pair
  on public.offers (listing_id, offered_listing_id) where status = 'PENDING';

-- Which participant chose to share their phone number in which accepted swap.
create table public.phone_shares (
  offer_id   uuid not null references public.offers(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);

-- ---------- triggers ----------
create trigger profiles_touch        before update on public.profiles        for each row execute function public.touch_updated_at();
create trigger profile_private_touch before update on public.profile_private for each row execute function public.touch_updated_at();
create trigger listings_touch        before update on public.listings        for each row execute function public.touch_updated_at();
create trigger offers_touch          before update on public.offers          for each row execute function public.touch_updated_at();

create or replace function public.bump_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_bump after insert on public.messages for each row execute function public.bump_conversation();

-- Create profile rows from signup metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, username, display_name, city, area)
  values (new.id, lower(btrim(m->>'username')), btrim(m->>'display_name'), btrim(m->>'city'), btrim(m->>'area'));
  insert into public.profile_private (id, phone_number)
  values (new.id, nullif(btrim(m->>'phone_number'), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- privileges (deny by default, then grant exactly what is needed) ----------
revoke all on public.profiles, public.profile_private, public.games, public.listings,
              public.listing_wanted_games, public.conversations, public.messages,
              public.offers, public.phone_shares from anon, authenticated;

grant select on public.profiles              to anon, authenticated;
grant update (username, display_name, profile_image, city, area) on public.profiles to authenticated;
grant select on public.games                 to anon, authenticated;
grant select on public.listings              to anon, authenticated;   -- writes only through RPCs
grant select on public.listing_wanted_games  to anon, authenticated;
grant select on public.profile_private       to authenticated;
grant update (phone_number) on public.profile_private to authenticated;
grant select on public.conversations         to authenticated;         -- created only through start_conversation()
grant select on public.messages              to authenticated;
grant insert (conversation_id, sender_id, message) on public.messages to authenticated;
grant select on public.offers                to authenticated;         -- changed only through RPCs
grant select on public.phone_shares          to authenticated;

-- ---------- row level security ----------
alter table public.profiles             enable row level security;
alter table public.profile_private      enable row level security;
alter table public.games                enable row level security;
alter table public.listings             enable row level security;
alter table public.listing_wanted_games enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.offers               enable row level security;
alter table public.phone_shares         enable row level security;

create policy profiles_select on public.profiles for select using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profile_private_select on public.profile_private for select to authenticated using (id = auth.uid());
create policy profile_private_update on public.profile_private for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy games_select on public.games for select using (true);

-- Used by the listings policy. SECURITY DEFINER so anonymous visitors can browse without
-- needing any privilege on offers/conversations.
create or replace function public.is_listing_participant(p_listing uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.offers o
                  where (o.listing_id = p_listing or o.offered_listing_id = p_listing)
                    and auth.uid() in (o.sender_id, o.receiver_id))
      or exists (select 1 from public.conversations c
                  where c.listing_id = p_listing and auth.uid() in (c.initiator_id, c.owner_id));
$$;
revoke all on function public.is_listing_participant(uuid) from public;
grant execute on function public.is_listing_participant(uuid) to anon, authenticated;

-- Active listings are public. Participants can still see their swap partner's listing
-- once it is reserved/completed.
create policy listings_select on public.listings for select using (
  status = 'ACTIVE'
  or owner_id = auth.uid()
  or public.is_listing_participant(id)
);

create policy lwg_select on public.listing_wanted_games for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);

create policy conversations_select on public.conversations for select to authenticated
  using (auth.uid() in (initiator_id, owner_id));

create policy messages_select on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and auth.uid() in (c.initiator_id, c.owner_id)));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid()
              and exists (select 1 from public.conversations c
                          where c.id = conversation_id and auth.uid() in (c.initiator_id, c.owner_id)));

create policy offers_select on public.offers for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));

create policy phone_shares_select on public.phone_shares for select to authenticated
  using (exists (select 1 from public.offers o
                 where o.id = offer_id and auth.uid() in (o.sender_id, o.receiver_id)));

-- ---------- realtime ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.offers;
  end if;
end $$;

-- =====================================================================
-- RPCs. All are SECURITY DEFINER: they derive identity from auth.uid(),
-- never from client-provided ids, and validate every relationship.
-- Lock order is always: listings (by id) -> offer, so concurrent accepts
-- cannot deadlock or both succeed.
-- =====================================================================

create or replace function public.username_available(p_username text) returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(btrim(p_username)));
$$;

create or replace function public.create_listing(
  p_game_id uuid, p_condition public.condition_t, p_description text,
  p_city text, p_area text, p_image_url text, p_wanted uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_wanted uuid[];
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  if not exists (select 1 from games where id = p_game_id) then perform baddel_fail('GAME_NOT_FOUND'); end if;
  if btrim(coalesce(p_city, '')) = '' or btrim(coalesce(p_area, '')) = '' then perform baddel_fail('LOCATION_REQUIRED'); end if;
  if p_image_url is not null and position('/' || v_uid::text || '/' in p_image_url) = 0 then perform baddel_fail('INVALID_IMAGE'); end if;

  v_wanted := array(select distinct w from unnest(coalesce(p_wanted, '{}'::uuid[])) w where w <> p_game_id);
  if coalesce(array_length(v_wanted, 1), 0) < 1 then perform baddel_fail('WANTED_REQUIRED'); end if;
  if array_length(v_wanted, 1) > 15 then perform baddel_fail('TOO_MANY_WANTED'); end if;
  if (select count(*) from games where id = any (v_wanted)) <> array_length(v_wanted, 1) then perform baddel_fail('GAME_NOT_FOUND'); end if;

  insert into listings (owner_id, game_id, condition, description, image_url, city, area)
  values (v_uid, p_game_id, p_condition, nullif(btrim(p_description), ''), p_image_url, btrim(p_city), btrim(p_area))
  returning id into v_id;

  insert into listing_wanted_games (listing_id, game_id) select v_id, unnest(v_wanted);
  return v_id;
end $$;

create or replace function public.update_listing(
  p_listing uuid, p_condition public.condition_t, p_description text,
  p_city text, p_area text, p_image_url text, p_wanted uuid[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  l listings%rowtype;
  v_wanted uuid[];
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into l from listings where id = p_listing for update;
  if not found then perform baddel_fail('LISTING_NOT_FOUND'); end if;
  if l.owner_id <> v_uid then perform baddel_fail('NOT_ALLOWED'); end if;
  if l.status <> 'ACTIVE' then perform baddel_fail('LISTING_NOT_ACTIVE'); end if;
  if btrim(coalesce(p_city, '')) = '' or btrim(coalesce(p_area, '')) = '' then perform baddel_fail('LOCATION_REQUIRED'); end if;
  if p_image_url is not null and position('/' || v_uid::text || '/' in p_image_url) = 0 then perform baddel_fail('INVALID_IMAGE'); end if;

  v_wanted := array(select distinct w from unnest(coalesce(p_wanted, '{}'::uuid[])) w where w <> l.game_id);
  if coalesce(array_length(v_wanted, 1), 0) < 1 then perform baddel_fail('WANTED_REQUIRED'); end if;
  if array_length(v_wanted, 1) > 15 then perform baddel_fail('TOO_MANY_WANTED'); end if;
  if (select count(*) from games where id = any (v_wanted)) <> array_length(v_wanted, 1) then perform baddel_fail('GAME_NOT_FOUND'); end if;

  update listings set condition = p_condition, description = nullif(btrim(p_description), ''),
         image_url = p_image_url, city = btrim(p_city), area = btrim(p_area)
   where id = p_listing;
  delete from listing_wanted_games where listing_id = p_listing;
  insert into listing_wanted_games (listing_id, game_id) select p_listing, unnest(v_wanted);
end $$;

create or replace function public.cancel_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  l listings%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into l from listings where id = p_listing for update;
  if not found then perform baddel_fail('LISTING_NOT_FOUND'); end if;
  if l.owner_id <> v_uid then perform baddel_fail('NOT_ALLOWED'); end if;
  if l.status <> 'ACTIVE' then perform baddel_fail('LISTING_NOT_ACTIVE'); end if;

  update listings set status = 'CANCELLED' where id = p_listing;
  -- offers made *by* the owner with this listing are cancelled; offers *for* it are rejected
  update offers
     set status = case when sender_id = v_uid then 'CANCELLED'::offer_status_t else 'REJECTED'::offer_status_t end
   where status = 'PENDING' and (listing_id = p_listing or offered_listing_id = p_listing);
end $$;

create or replace function public.create_offer(p_target uuid, p_offered uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t listings%rowtype;
  o listings%rowtype;
  v_id uuid;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  if p_target = p_offered then perform baddel_fail('SAME_LISTING'); end if;

  perform 1 from listings where id in (p_target, p_offered) order by id for update;
  select * into t from listings where id = p_target;
  if not found then perform baddel_fail('LISTING_NOT_FOUND'); end if;
  select * into o from listings where id = p_offered;
  if not found then perform baddel_fail('OFFERED_NOT_FOUND'); end if;

  if t.owner_id = v_uid then perform baddel_fail('OWN_LISTING'); end if;
  if o.owner_id <> v_uid then perform baddel_fail('NOT_YOUR_LISTING'); end if;
  if t.status <> 'ACTIVE' then perform baddel_fail('TARGET_NOT_ACTIVE'); end if;
  if o.status <> 'ACTIVE' then perform baddel_fail('OFFERED_NOT_ACTIVE'); end if;
  if exists (select 1 from offers where listing_id = p_target and offered_listing_id = p_offered and status = 'PENDING')
    then perform baddel_fail('DUPLICATE_OFFER'); end if;

  insert into offers (listing_id, sender_id, receiver_id, offered_listing_id)
  values (p_target, v_uid, t.owner_id, p_offered)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  f offers%rowtype;
  t listings%rowtype;
  o listings%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into f from offers where id = p_offer;
  if not found then perform baddel_fail('OFFER_NOT_FOUND'); end if;
  if f.receiver_id <> v_uid then perform baddel_fail('NOT_ALLOWED'); end if;

  -- lock both listings first (fixed order), then the offer
  perform 1 from listings where id in (f.listing_id, f.offered_listing_id) order by id for update;
  select * into f from offers where id = p_offer for update;
  if f.status <> 'PENDING' then perform baddel_fail('OFFER_NOT_PENDING'); end if;

  select * into t from listings where id = f.listing_id;
  select * into o from listings where id = f.offered_listing_id;
  if t.status <> 'ACTIVE' or o.status <> 'ACTIVE' then perform baddel_fail('LISTING_UNAVAILABLE'); end if;
  if t.owner_id <> f.receiver_id or o.owner_id <> f.sender_id then perform baddel_fail('LISTING_UNAVAILABLE'); end if;

  update offers   set status = 'ACCEPTED'      where id = p_offer;
  update listings set status = 'SWAP_PENDING'  where id in (t.id, o.id);
  -- every other pending offer touching either reserved game is no longer valid
  update offers set status = 'REJECTED'
   where status = 'PENDING' and id <> p_offer
     and (listing_id in (t.id, o.id) or offered_listing_id in (t.id, o.id));
end $$;

create or replace function public.reject_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); f offers%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into f from offers where id = p_offer for update;
  if not found then perform baddel_fail('OFFER_NOT_FOUND'); end if;
  if f.receiver_id <> v_uid then perform baddel_fail('NOT_ALLOWED'); end if;
  if f.status <> 'PENDING' then perform baddel_fail('OFFER_NOT_PENDING'); end if;
  update offers set status = 'REJECTED' where id = p_offer;
end $$;

create or replace function public.cancel_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); f offers%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into f from offers where id = p_offer for update;
  if not found then perform baddel_fail('OFFER_NOT_FOUND'); end if;
  if f.sender_id <> v_uid then perform baddel_fail('NOT_ALLOWED'); end if;
  if f.status <> 'PENDING' then perform baddel_fail('OFFER_NOT_PENDING'); end if;
  update offers set status = 'CANCELLED' where id = p_offer;
end $$;

create or replace function public.share_phone(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); f offers%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into f from offers where id = p_offer;
  if not found then perform baddel_fail('OFFER_NOT_FOUND'); end if;
  if v_uid not in (f.sender_id, f.receiver_id) then perform baddel_fail('NOT_ALLOWED'); end if;
  if f.status <> 'ACCEPTED' then perform baddel_fail('OFFER_NOT_ACCEPTED'); end if;
  if not exists (select 1 from profile_private where id = v_uid and phone_number is not null)
    then perform baddel_fail('PHONE_MISSING'); end if;
  insert into phone_shares (offer_id, user_id) values (p_offer, v_uid) on conflict do nothing;
end $$;

-- Returns the swap partner's number only if the partner explicitly shared it for this offer.
create or replace function public.get_partner_phone(p_offer uuid) returns text
language plpgsql security definer stable set search_path = public as $$
declare v_uid uuid := auth.uid(); f offers%rowtype; v_partner uuid; v_phone text;
begin
  if v_uid is null then return null; end if;
  select * into f from offers where id = p_offer;
  if not found or v_uid not in (f.sender_id, f.receiver_id) then return null; end if;
  if f.status not in ('ACCEPTED', 'COMPLETED') then return null; end if;
  v_partner := case when v_uid = f.sender_id then f.receiver_id else f.sender_id end;
  if not exists (select 1 from phone_shares where offer_id = p_offer and user_id = v_partner) then return null; end if;
  select phone_number into v_phone from profile_private where id = v_partner;
  return v_phone;
end $$;

create or replace function public.confirm_completion(p_offer uuid) returns public.offer_status_t
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); f offers%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into f from offers where id = p_offer;
  if not found then perform baddel_fail('OFFER_NOT_FOUND'); end if;
  if v_uid not in (f.sender_id, f.receiver_id) then perform baddel_fail('NOT_ALLOWED'); end if;

  perform 1 from listings where id in (f.listing_id, f.offered_listing_id) order by id for update;
  select * into f from offers where id = p_offer for update;
  if f.status <> 'ACCEPTED' then perform baddel_fail('OFFER_NOT_ACCEPTED'); end if;

  if v_uid = f.sender_id then
    update offers set sender_confirmed_at = coalesce(sender_confirmed_at, now()) where id = p_offer;
  else
    update offers set receiver_confirmed_at = coalesce(receiver_confirmed_at, now()) where id = p_offer;
  end if;

  select * into f from offers where id = p_offer;
  if f.sender_confirmed_at is not null and f.receiver_confirmed_at is not null then
    update offers   set status = 'COMPLETED' where id = p_offer;
    update listings set status = 'COMPLETED' where id in (f.listing_id, f.offered_listing_id);
    return 'COMPLETED';
  end if;
  return 'ACCEPTED';
end $$;

-- Listing-specific conversation. Always tied to one listing; never with yourself.
create or replace function public.start_conversation(p_listing uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); l listings%rowtype; v_id uuid;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into l from listings where id = p_listing;
  if not found then perform baddel_fail('LISTING_NOT_FOUND'); end if;
  if l.owner_id = v_uid then perform baddel_fail('OWN_LISTING'); end if;

  select id into v_id from conversations where listing_id = p_listing and initiator_id = v_uid;
  if v_id is not null then return v_id; end if;
  if l.status <> 'ACTIVE' then perform baddel_fail('LISTING_NOT_ACTIVE'); end if;

  insert into conversations (listing_id, initiator_id, owner_id) values (p_listing, v_uid, l.owner_id)
  on conflict (listing_id, initiator_id) do nothing;
  select id into v_id from conversations where listing_id = p_listing and initiator_id = v_uid;
  return v_id;
end $$;

-- Opens (or creates) the conversation attached to an offer's target listing, for either participant.
create or replace function public.open_offer_conversation(p_offer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); f offers%rowtype; v_id uuid;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  select * into f from offers where id = p_offer;
  if not found then perform baddel_fail('OFFER_NOT_FOUND'); end if;
  if v_uid not in (f.sender_id, f.receiver_id) then perform baddel_fail('NOT_ALLOWED'); end if;

  insert into conversations (listing_id, initiator_id, owner_id) values (f.listing_id, f.sender_id, f.receiver_id)
  on conflict (listing_id, initiator_id) do nothing;
  select id into v_id from conversations where listing_id = f.listing_id and initiator_id = f.sender_id;
  return v_id;
end $$;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  update messages set read_at = now()
   where conversation_id = p_conversation and sender_id <> v_uid and read_at is null
     and exists (select 1 from conversations c where c.id = p_conversation and v_uid in (c.initiator_id, c.owner_id));
end $$;

create or replace function public.my_conversations()
returns table (conversation_id uuid, listing_id uuid, other_user_id uuid,
               last_message text, last_message_at timestamptz, unread_count bigint)
language sql security definer stable set search_path = public as $$
  select c.id, c.listing_id,
         case when c.initiator_id = auth.uid() then c.owner_id else c.initiator_id end,
         lm.message, coalesce(lm.created_at, c.created_at),
         (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
    from conversations c
    left join lateral (select m.message, m.created_at from messages m
                        where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
   where auth.uid() in (c.initiator_id, c.owner_id)
   order by 5 desc;
$$;

create or replace function public.unread_message_count() returns bigint
language sql security definer stable set search_path = public as $$
  select count(*) from messages m join conversations c on c.id = m.conversation_id
   where auth.uid() in (c.initiator_id, c.owner_id) and m.sender_id <> auth.uid() and m.read_at is null;
$$;

-- lock down function execution
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('username_available','create_listing','update_listing','cancel_listing','create_offer',
                         'accept_offer','reject_offer','cancel_offer','share_phone','get_partner_phone',
                         'confirm_completion','start_conversation','open_offer_conversation',
                         'mark_conversation_read','my_conversations','unread_message_count')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.proname = 'username_available' then
      execute format('grant execute on function %s to anon, authenticated', r.sig);
    else
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- ---------- storage (avatars + listing photos) ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true), ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "public read baddel images" on storage.objects for select
  using (bucket_id in ('avatars', 'listing-images'));
create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'listing-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own files" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'listing-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'listing-images') and (storage.foldername(name))[1] = auth.uid()::text);
