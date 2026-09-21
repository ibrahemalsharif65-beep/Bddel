-- =====================================================================
-- 0002: users can add games that are not in the catalogue, and the
--       "games wanted" list on a listing becomes optional.
-- Run this after 0001_schema.sql.
-- =====================================================================

-- Who added a game (null = imported catalogue) and case-insensitive uniqueness.
alter table public.games add column if not exists created_by uuid references public.profiles(id) on delete set null;
create unique index if not exists games_title_platform_ci on public.games (lower(btrim(title)), platform);

-- Adds a game to the shared catalogue, or returns the existing one (same title + platform, ignoring case/spacing).
create or replace function public.add_game(p_title text, p_platform public.platform_t) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  g games%rowtype;
begin
  if v_uid is null then perform baddel_fail('NOT_AUTHENTICATED'); end if;
  v_title := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  if char_length(v_title) < 2 or char_length(v_title) > 100 then perform baddel_fail('TITLE_INVALID'); end if;

  select * into g from games where lower(btrim(title)) = lower(v_title) and platform = p_platform;
  if found then return g; end if;

  if (select count(*) from games where created_by = v_uid and created_at > now() - interval '1 day') >= 20
    then perform baddel_fail('TOO_MANY_NEW_GAMES'); end if;

  insert into games (title, platform, created_by) values (v_title, p_platform, v_uid) returning * into g;
  return g;
exception when unique_violation then
  select * into g from games where lower(btrim(title)) = lower(v_title) and platform = p_platform;
  return g;
end $$;

-- Same as 0001 but WANTED_REQUIRED is gone: an empty wanted list means "open to any offer".
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
  if coalesce(array_length(v_wanted, 1), 0) > 15 then perform baddel_fail('TOO_MANY_WANTED'); end if;
  if (select count(*) from games where id = any (v_wanted)) <> coalesce(array_length(v_wanted, 1), 0) then perform baddel_fail('GAME_NOT_FOUND'); end if;

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
  if coalesce(array_length(v_wanted, 1), 0) > 15 then perform baddel_fail('TOO_MANY_WANTED'); end if;
  if (select count(*) from games where id = any (v_wanted)) <> coalesce(array_length(v_wanted, 1), 0) then perform baddel_fail('GAME_NOT_FOUND'); end if;

  update listings set condition = p_condition, description = nullif(btrim(p_description), ''),
         image_url = p_image_url, city = btrim(p_city), area = btrim(p_area)
   where id = p_listing;
  delete from listing_wanted_games where listing_id = p_listing;
  insert into listing_wanted_games (listing_id, game_id) select p_listing, unnest(v_wanted);
end $$;

revoke all on function public.add_game(text, public.platform_t) from public, anon, authenticated;
grant execute on function public.add_game(text, public.platform_t) to authenticated;
