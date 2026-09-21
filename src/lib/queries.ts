// Shared PostgREST select strings. Hints (e.g. games!game_id) pick the exact foreign key.
export const GAME_FIELDS = 'id,title,platform,cover_image';
export const PROFILE_FIELDS = 'id,username,display_name,profile_image,city,area';

export const LISTING_LITE = `id,owner_id,status,condition,image_url,city,area,game:games!game_id(${GAME_FIELDS})`;

export const LISTING_SELECT =
  `id,owner_id,status,condition,description,image_url,city,area,created_at,` +
  `game:games!game_id(${GAME_FIELDS}),owner:profiles!owner_id(${PROFILE_FIELDS}),` +
  `wanted:listing_wanted_games(game:games!game_id(${GAME_FIELDS}))`;

// Same as LISTING_SELECT but with an inner join on the game so browse can filter by title/platform.
export const LISTING_SELECT_FILTERABLE = LISTING_SELECT.replace('game:games!game_id(', 'game:games!game_id!inner(');

export const OFFER_SELECT =
  `id,status,created_at,updated_at,sender_id,receiver_id,listing_id,offered_listing_id,sender_confirmed_at,receiver_confirmed_at,` +
  `target:listings!listing_id(${LISTING_LITE}),offered:listings!offered_listing_id(${LISTING_LITE}),` +
  `sender:profiles!sender_id(${PROFILE_FIELDS}),receiver:profiles!receiver_id(${PROFILE_FIELDS})`;
