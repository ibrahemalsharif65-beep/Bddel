import Link from 'next/link';
import type { Listing } from '@/lib/types';
import type { MatchInfo } from '@/lib/matching';
import { CONDITIONS } from '@/lib/constants';
import { GameCover, ListingStatusBadge, PlatformBadge } from './ui';

export function ListingCard({ listing, match, preview = false }: { listing: Listing; match?: MatchInfo; preview?: boolean }) {
  const owned = new Set((match?.youHave ?? []).map((m) => m.game.id));
  const cover = <GameCover game={listing.game} imageUrl={listing.image_url} />;
  const title = <h3>{listing.game.title}</h3>;
  const shown = listing.wanted.slice(0, 4);
  const extra = listing.wanted.length - shown.length;

  let matchNote: string | null = null;
  if (match && match.mutual.length > 0) {
    matchNote = `Mutual match: they want your ${match.mutual.map((m) => m.game.title).join(' or ')}, and you are looking for ${listing.game.title}.`;
  } else if (match && match.youHave.length > 0) {
    matchNote = `This user is looking for ${match.youHave.map((m) => m.game.title).join(' or ')}. You have it.`;
  }

  return (
    <article className="card listing-card">
      {preview ? (
        <div className="cover-wrap">{cover}</div>
      ) : (
        <Link href={`/listings/${listing.id}`} className="cover-wrap" aria-label={`Open ${listing.game.title}`}>
          {cover}
          {listing.status !== 'ACTIVE' ? <ListingStatusBadge status={listing.status} /> : null}
        </Link>
      )}
      <div className="meta">
        {preview ? title : <Link href={`/listings/${listing.id}`}>{title}</Link>}
        <div className="row" style={{ gap: '.5rem' }}>
          <PlatformBadge platform={listing.game.platform} />
          <span className="small muted">{CONDITIONS[listing.condition]}</span>
        </div>
        <div className="small muted">{listing.city} · {listing.area}</div>
        <div className="owner-line">
          by {preview ? listing.owner.display_name : <Link href={`/u/${listing.owner.username}`}>{listing.owner.display_name}</Link>}
        </div>
        <div>
          {listing.wanted.length === 0 ? (
            <span className="chip chip-want">Open to any offer</span>
          ) : (
            <>
              <div className="want-label">Would swap for any one of:</div>
              <div className="chips" style={{ marginTop: 4 }}>
                {shown.map(({ game }) => (
                  <span key={game.id} className={`chip ${owned.has(game.id) ? 'chip-match' : 'chip-want'}`}>
                    {game.title} <span className="muted">{game.platform}</span>
                  </span>
                ))}
                {extra > 0 ? <span className="chip">+{extra} more</span> : null}
              </div>
            </>
          )}
        </div>
        {matchNote ? <div className="match-note">{matchNote}</div> : null}
      </div>
    </article>
  );
}
