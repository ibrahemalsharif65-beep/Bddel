import type { SupabaseClient } from '@supabase/supabase-js';
import type { MyListingForMatching } from './matching';
import type { Game } from './types';
import { GAME_FIELDS } from './queries';

/** The current user's ACTIVE listings with their wanted-game ids, used for match indicators. */
export async function getMyMatchData(supabase: SupabaseClient, userId: string | null): Promise<MyListingForMatching[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from('listings')
    .select(`id,game:games!game_id(${GAME_FIELDS}),wanted:listing_wanted_games(game_id)`)
    .eq('owner_id', userId)
    .eq('status', 'ACTIVE');
  return ((data ?? []) as unknown as { id: string; game: Game; wanted: { game_id: string }[] }[]).map((l) => ({
    id: l.id,
    game: l.game,
    wantedIds: l.wanted.map((w) => w.game_id),
  }));
}
