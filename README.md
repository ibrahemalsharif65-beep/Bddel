# Baddel

Swap physical PS4 / PS5 game discs in Egypt, one game for one game.
Next.js 15 (App Router) + Supabase (Auth, Postgres with RLS, Realtime, Storage).

```
List a game → choose wanted games → discover matches → message about that listing
→ 1-to-1 offer → accept / reject → optional phone share → both confirm the swap
```

## Setup

1. Create a Supabase project.
2. SQL Editor, one file at a time, in this order: `supabase/migrations/0001_schema.sql`, then `0002_custom_games_optional_wanted.sql`, then `supabase/seed.sql` (a starter list of about 120 titles).
3. Authentication → URL Configuration: set Site URL to `http://localhost:3000` and add
   `http://localhost:3000/auth/callback` to Redirect URLs (add your production URL too).
   For quick local testing you can turn off "Confirm email".
4. `cp .env.example .env.local` and fill in the project URL and anon key.
5. `npm install && npm run dev`

### Getting every PS4 / PS5 game

The PlayStation Store has no public catalogue API, so `scripts/import-games.mjs` pulls the full PS4 and PS5 lists (with box art) from IGDB and adds whatever is missing. Free Twitch/IGDB keys and the steps are in the header of the script, then run `npm run import:games` (add `--dry-run` to only count). It is safe to re-run. Anything still missing can be added by users from the game picker, and it joins the shared catalogue for everyone.

Realtime for `messages` and `offers` is enabled by the migration. Avatar and listing photo buckets are created by it too.

## Where the rules live

All swap rules are enforced in Postgres, not in the UI (`supabase/migrations/0001_schema.sql`):

| Rule | How |
| --- | --- |
| Listing/offer statuses can't be edited by clients | Clients have no INSERT/UPDATE on `listings` or `offers`; every change goes through `SECURITY DEFINER` functions (`create_offer`, `accept_offer`, `reject_offer`, `cancel_offer`, `cancel_listing`, `confirm_completion`, ...) |
| Sender / receiver / ownership can't be spoofed | Functions read `auth.uid()` and derive receiver from the target listing; the client only sends two listing ids |
| Two offers can't both win the same game | `accept_offer` locks both listings in id order, re-checks everything, reserves both, then rejects every other pending offer touching either listing |
| Phone numbers never public | Stored in `profile_private` (owner-only RLS). Partner can read it only via `get_partner_phone(offer)` after they pressed Share on an ACCEPTED offer (`phone_shares`) |
| Conversations are private and listing-bound | `conversations.listing_id` is required, created only by `start_conversation` / `open_offer_conversation`; RLS limits reads and inserts to the two participants; a CHECK blocks messaging yourself; empty messages fail a CHECK |
| Completion needs both people | `confirm_completion` stamps your side; only when both are stamped do the offer and both listings become COMPLETED |

Errors raised by the database look like `BADDEL:LISTING_UNAVAILABLE`; the UI maps them to plain messages (`src/lib/errors.ts`).

## Matching

`src/lib/matching.ts` compares real rows only: my ACTIVE listings vs. the other listing's wanted list. "This user is looking for X" appears only if you own an active X. "Mutual match" appears only if, in addition, one of your listings' wanted lists includes their game.

## Tests

`supabase/tests/` contains the two-user scenario (Spider-Man 2 ↔ FC 26, plus a third user with a conflicting offer) and every rejection case as plain SQL, runnable on a scratch Postgres:

```
createdb bt
psql bt -f supabase/tests/00_supabase_stubs.sql   # minimal auth/storage stand-ins (run once per DB; create the anon/authenticated roles first)
psql bt -f supabase/migrations/0001_schema.sql -f supabase/seed.sql
psql bt -f supabase/tests/01_swap_flow.sql
```

## Notes

- Game covers: the seed leaves `games.cover_image` empty and the UI draws a generated cover with the title. Set `cover_image` URLs in the `games` table to show real box art. To add a missing game, insert a row into `games`.
- Search runs on the server as you type. If a game is missing, the picker lets the user add it (`add_game`, deduplicated ignoring case, max 20 new games per user per day). Every listing and wanted game still points at a row in `games`.
- Wanted games are optional. An empty list shows "Open to any offer"; the owner's listing page then shows real listings that want their game (and, if wanted games were named, listings that have them).
- Cancelling an accepted swap is not part of the spec, so there is no UI for it.
