import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CancelListingButton, MessageUserButton } from '@/components/ListingActions';
import { ListingCard } from '@/components/ListingCard';
import { Avatar, GameCover, ListingStatusBadge, Notice, PlatformBadge } from '@/components/ui';
import { CONDITIONS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { computeMatch } from '@/lib/matching';
import { LISTING_SELECT } from '@/lib/queries';
import { getMyMatchData } from '@/lib/server-data';
import { createClient } from '@/lib/supabase/server';
import type { Listing } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('listings').select('game:games!game_id(title,platform)').eq('id', id).maybeSingle();
  const g = data?.game as unknown as { title: string; platform: string } | undefined;
  return { title: g ? `${g.title} (${g.platform})` : 'Listing' };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).maybeSingle();
  if (!data) notFound();
  const listing = data as unknown as Listing;

  const isOwner = user?.id === listing.owner_id;
  const mine = await getMyMatchData(supabase, user?.id ?? null);
  const match = computeMatch(listing, mine, user?.id ?? null);
  const owned = new Set(match.youHave.map((m) => m.game.id));
  const active = listing.status === 'ACTIVE';

  // "Options" for the owner: real listings that want this game, and (if the owner named wanted games) listings that have one.
  let wantMine: Listing[] = [];
  let haveWanted: Listing[] = [];
  if (isOwner && listing.status === 'ACTIVE') {
    const { data: rows } = await supabase.from('listing_wanted_games').select('listing_id').eq('game_id', listing.game.id).limit(200);
    const ids = (rows ?? []).map((r: { listing_id: string }) => r.listing_id).filter((x: string) => x !== id);
    const wantedIds = listing.wanted.map((w) => w.game.id);
    const [a, b] = await Promise.all([
      ids.length
        ? supabase.from('listings').select(LISTING_SELECT).in('id', ids).eq('status', 'ACTIVE').neq('owner_id', user!.id).order('created_at', { ascending: false }).limit(12)
        : Promise.resolve({ data: [] }),
      wantedIds.length
        ? supabase.from('listings').select(LISTING_SELECT).in('game_id', wantedIds).eq('status', 'ACTIVE').neq('owner_id', user!.id).order('created_at', { ascending: false }).limit(12)
        : Promise.resolve({ data: [] }),
    ]);
    wantMine = (a.data ?? []) as unknown as Listing[];
    haveWanted = (b.data ?? []) as unknown as Listing[];
  }

  let pendingReceived = 0;
  if (isOwner) {
    const { count } = await supabase.from('offers').select('id', { count: 'exact', head: true }).eq('listing_id', id).eq('status', 'PENDING');
    pendingReceived = count ?? 0;
  }

  return (
    <div className="stack-lg">
      {sp.published ? <Notice kind="success">Your listing is live. It now appears in Browse.</Notice> : null}
      {sp.updated ? <Notice kind="success">Listing updated.</Notice> : null}

      <div className="detail">
        <div><GameCover game={listing.game} imageUrl={listing.image_url} /></div>

        <div className="stack">
          <div className="row"><h1>{listing.game.title}</h1></div>
          <div className="row"><PlatformBadge platform={listing.game.platform} /><ListingStatusBadge status={listing.status} /></div>

          <dl className="kv panel" style={{ margin: 0 }}>
            <dt>Condition</dt><dd>{CONDITIONS[listing.condition]}</dd>
            <dt>Location</dt><dd>{listing.city} · {listing.area}</dd>
            <dt>Listed</dt><dd>{formatDate(listing.created_at)}</dd>
            {listing.description ? (<><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{listing.description}</dd></>) : null}
          </dl>

          <div className="panel stack" style={{ gap: '.6rem' }}>
            {listing.wanted.length === 0 ? (
              <>
                <h2>Open to any offer</h2>
                <p className="muted small">{isOwner ? 'You did not pick specific games, so anyone can offer you a game. See who wants yours below.' : `${listing.owner.display_name} did not pick specific games. Make an offer with any game you own.`}</p>
              </>
            ) : (
              <>
                <h2>Would swap for any one of</h2>
                <div className="chips">
                  {listing.wanted.map(({ game }) => (
                    <span key={game.id} className={`chip ${owned.has(game.id) ? 'chip-match' : 'chip-want'}`}>
                      {game.title} <span className="muted">{game.platform}</span>
                      {owned.has(game.id) ? <strong> · you have this</strong> : null}
                    </span>
                  ))}
                </div>
                <p className="muted small">The owner is happy with any single one of these games, not all of them.</p>
              </>
            )}
          </div>

          {match.youHave.length > 0 && active ? (
            <div className="match-note" style={{ fontSize: '.95rem', padding: '.8rem 1rem' }}>
              <div>
                {match.mutual.length > 0
                  ? `Mutual match: ${listing.owner.display_name} wants your ${match.mutual.map((m) => m.game.title).join(' or ')}, and you are looking for ${listing.game.title}.`
                  : `This user is looking for ${match.youHave.map((m) => m.game.title).join(' or ')}. You have it.`}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                {match.youHave.slice(0, 3).map((m) => (
                  <Link key={m.id} className="btn btn-swap btn-sm" href={`/listings/${id}/offer?offer=${m.id}`}>Offer your {m.game.title}</Link>
                ))}
              </div>
            </div>
          ) : null}

          {!active ? (
            <Notice kind="info">
              {listing.status === 'SWAP_PENDING' ? 'This game is reserved for a swap that is in progress. It cannot receive new offers.' : listing.status === 'COMPLETED' ? 'This game has been swapped.' : 'The owner cancelled this listing.'}
            </Notice>
          ) : null}

          <div className="row">
            {!user ? (
              <Link className="btn btn-primary" href={`/login?next=/listings/${id}`}>Log in to message or make an offer</Link>
            ) : isOwner ? (
              <>
                {active ? <Link className="btn btn-outline" href={`/listings/${id}/edit`}>Edit listing</Link> : null}
                {active ? <CancelListingButton listingId={id} /> : null}
                <Link className="btn btn-outline" href="/offers?tab=received">
                  Offers received{pendingReceived > 0 ? <span className="count">{pendingReceived}</span> : null}
                </Link>
              </>
            ) : active ? (
              <>
                <Link className="btn btn-primary" href={`/listings/${id}/offer`}>Make Offer</Link>
                <MessageUserButton listingId={id} />
              </>
            ) : null}
          </div>

          <Link href={`/u/${listing.owner.username}`} className="card owner-card">
            <Avatar name={listing.owner.display_name} url={listing.owner.profile_image} />
            <div>
              <strong>{listing.owner.display_name}</strong>
              <div className="small muted">@{listing.owner.username} · {listing.owner.city}, {listing.owner.area}</div>
            </div>
          </Link>
        </div>
      </div>

      {isOwner && active ? (
        <section className="stack" aria-label="Options for this listing">
          <div>
            <h2>Listings that want {listing.game.title}</h2>
            <p className="muted small">These owners listed your game as one they would accept. Pick one and offer yours.</p>
          </div>
          {wantMine.length === 0 ? (
            <div className="empty"><p>Nobody has listed {listing.game.title} as a wanted game yet. New listings show up here automatically.</p></div>
          ) : (
            <div className="grid-cards">
              {wantMine.map((l) => (
                <div key={l.id} className="stack" style={{ gap: '.5rem' }}>
                  <ListingCard listing={l} match={computeMatch(l, mine, user!.id)} />
                  <Link className="btn btn-swap btn-sm" href={`/listings/${l.id}/offer?offer=${id}`}>Offer {listing.game.title} for this</Link>
                </div>
              ))}
            </div>
          )}

          {listing.wanted.length > 0 ? (
            <>
              <div>
                <h2>Listings with a game you want</h2>
                <p className="muted small">Active listings for the games you named as wanted. They may or may not want yours.</p>
              </div>
              {haveWanted.length === 0 ? (
                <div className="empty"><p>None of your wanted games are listed right now.</p></div>
              ) : (
                <div className="grid-cards">
                  {haveWanted.map((l) => (
                    <div key={l.id} className="stack" style={{ gap: '.5rem' }}>
                      <ListingCard listing={l} match={computeMatch(l, mine, user!.id)} />
                      <Link className="btn btn-outline btn-sm" href={`/listings/${l.id}/offer?offer=${id}`}>Make an offer</Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted small">Want to look around? <Link href="/browse" style={{ textDecoration: 'underline' }}>Browse all listings</Link> and make an offer on anything you like.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
