import type { Game, ListingStatus, OfferStatus } from '@/lib/types';
import { LISTING_STATUS_LABEL, OFFER_STATUS_LABEL } from '@/lib/constants';

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Box art. When a game has no cover image, a generated cover with its title is shown instead. */
export function GameCover({ game, imageUrl, small }: { game: Pick<Game, 'title' | 'platform' | 'cover_image'>; imageUrl?: string | null; small?: boolean }) {
  const src = imageUrl || game.cover_image;
  const cls = `cover${small ? ' cover-sm' : ''}`;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={src} alt={`${game.title} cover`} loading="lazy" />;
  }
  const hue = hash(game.title + game.platform) % 360;
  return (
    <div
      className={`${cls} cover-fallback`}
      role="img"
      aria-label={`${game.title} cover`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 55% 40%), hsl(${(hue + 55) % 360} 60% 18%))` }}
    >
      <span>{game.title}</span>
      <em>{game.platform}</em>
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  return <span className={`platform ${platform.toLowerCase()}`}>{platform}</span>;
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`status st-${status}`}>{LISTING_STATUS_LABEL[status]}</span>;
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return <span className={`status st-${status}`}>{OFFER_STATUS_LABEL[status]}</span>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'success' | 'error'; children: React.ReactNode }) {
  return <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" style={style} src={url} alt={name} />;
  }
  return <span className="avatar" style={style} aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>;
}
