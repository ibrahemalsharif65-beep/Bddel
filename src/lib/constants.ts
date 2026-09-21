import type { Condition, ListingStatus, OfferStatus } from './types';

export const CITIES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia', 'Beheira',
  'Port Said', 'Suez', 'Ismailia', 'Damietta', 'Kafr El Sheikh', 'Fayoum', 'Beni Suef', 'Minya',
  'Assiut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'Matrouh', 'North Sinai', 'South Sinai', 'New Valley',
];

// Suggestions only; the Area field accepts any text.
export const AREA_SUGGESTIONS = [
  'Nasr City', 'Heliopolis', 'Maadi', 'New Cairo', 'Shorouk', 'Madinaty', 'Rehab', 'Zamalek', 'Downtown',
  'Shubra', 'Ain Shams', 'Helwan', 'Mokattam', 'Obour', 'Dokki', 'Mohandessin', 'Agouza', 'Haram', 'Faisal',
  '6th of October', 'Sheikh Zayed', 'Hadayek El Ahram', 'Smouha', 'Sidi Gaber', 'Miami', 'Montaza',
];

export const CONDITIONS: Record<Condition, string> = {
  NEW: 'New',
  USED_LIKE_NEW: 'Used - Like New',
  USED_GOOD: 'Used - Good',
  USED_FAIR: 'Used - Fair',
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: 'Active',
  SWAP_PENDING: 'Swap pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PHONE_RE = /^\+?[0-9]{8,15}$/;
export const cleanPhone = (v: string) => v.replace(/[\s-]/g, '');
