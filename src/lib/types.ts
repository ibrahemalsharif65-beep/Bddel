export type Platform = 'PS4' | 'PS5';
export type Condition = 'NEW' | 'USED_LIKE_NEW' | 'USED_GOOD' | 'USED_FAIR';
export type ListingStatus = 'ACTIVE' | 'SWAP_PENDING' | 'COMPLETED' | 'CANCELLED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Game {
  id: string;
  title: string;
  platform: Platform;
  cover_image: string | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  profile_image: string | null;
  city: string;
  area: string;
}

export interface ListingLite {
  id: string;
  owner_id: string;
  status: ListingStatus;
  condition: Condition;
  image_url: string | null;
  city: string;
  area: string;
  game: Game;
}

export interface Listing extends ListingLite {
  description: string | null;
  created_at: string;
  owner: PublicProfile;
  wanted: { game: Game }[];
}

export interface Offer {
  id: string;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
  sender_id: string;
  receiver_id: string;
  listing_id: string;
  offered_listing_id: string;
  sender_confirmed_at: string | null;
  receiver_confirmed_at: string | null;
  target: ListingLite;
  offered: ListingLite;
  sender: PublicProfile;
  receiver: PublicProfile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}
