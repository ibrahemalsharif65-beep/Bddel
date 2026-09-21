import type { Game, Listing } from './types';

export interface MyListingForMatching {
  id: string;
  game: Game;
  wantedIds: string[];
}

export interface MatchInfo {
  /** My active listings whose game is on this listing's wanted list. */
  youHave: MyListingForMatching[];
  /** Subset of youHave where one of my wanted games is this listing's game (a true two-way match). */
  mutual: MyListingForMatching[];
}

/**
 * Pure comparison of database rows. It never invents a match: everything returned is a listing
 * the current user actually owns (ACTIVE) that appears in the other listing's wanted list.
 */
export function computeMatch(listing: Pick<Listing, 'game' | 'wanted' | 'owner_id'>, mine: MyListingForMatching[], userId: string | null): MatchInfo {
  if (!userId || listing.owner_id === userId) return { youHave: [], mutual: [] };
  const wanted = new Set(listing.wanted.map((w) => w.game.id));
  const youHave = mine.filter((m) => wanted.has(m.game.id));
  const mutual = youHave.filter((m) => m.wantedIds.includes(listing.game.id));
  return { youHave, mutual };
}
