const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Please log in to continue.',
  NOT_ALLOWED: 'You are not allowed to do that.',
  GAME_NOT_FOUND: 'One of the selected games does not exist.',
  LOCATION_REQUIRED: 'Please enter a city and an area.',
  INVALID_IMAGE: 'That image could not be used. Please upload it again.',
  WANTED_REQUIRED: 'Choose at least one game you would accept in exchange.',
  TITLE_INVALID: 'Enter the full game title (2 to 100 characters).',
  TOO_MANY_NEW_GAMES: 'You have added a lot of new games today. Try again tomorrow, or search for the game again.',
  TOO_MANY_WANTED: 'You can pick up to 15 wanted games.',
  LISTING_NOT_FOUND: 'This listing no longer exists.',
  OFFERED_NOT_FOUND: 'The game you selected no longer exists.',
  LISTING_NOT_ACTIVE: 'This listing is no longer active.',
  TARGET_NOT_ACTIVE: 'This game is not available for new offers right now.',
  OFFERED_NOT_ACTIVE: 'The game you selected is not active anymore, so it cannot be offered.',
  OWN_LISTING: 'You cannot do that with your own listing.',
  NOT_YOUR_LISTING: 'You can only offer games you own.',
  SAME_LISTING: 'You cannot offer a game for itself.',
  DUPLICATE_OFFER: 'You already have a pending offer with these two games.',
  OFFER_NOT_FOUND: 'This offer no longer exists.',
  OFFER_NOT_PENDING: 'This offer is no longer pending, so it cannot be changed.',
  OFFER_NOT_ACCEPTED: 'This action is only available after an offer has been accepted.',
  LISTING_UNAVAILABLE: 'This game is no longer available for this offer. It is already part of another swap or was removed.',
  PHONE_MISSING: 'Add a phone number to your profile first, then share it.',
};

export function friendlyError(err: unknown): string {
  const raw = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  const code = raw.match(/BADDEL:([A-Z_]+)/)?.[1];
  if (code && MESSAGES[code]) return MESSAGES[code];
  return 'Something went wrong. Please try again.';
}

export function authError(err: unknown): string {
  const raw = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message).toLowerCase() : '';
  if (raw.includes('invalid login')) return 'Email or password is incorrect.';
  if (raw.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  if (raw.includes('already registered') || raw.includes('already been registered')) return 'An account with this email already exists. Try logging in.';
  if (raw.includes('password') && raw.includes('characters')) return 'Use a password with at least 8 characters.';
  if (raw.includes('rate limit') || raw.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (raw.includes('database error')) return 'Could not create the account. Check your username, name, city and area.';
  return 'Something went wrong. Please try again.';
}
