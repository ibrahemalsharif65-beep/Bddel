'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Offer } from '@/lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { GameCover, Notice, OfferStatusBadge, PlatformBadge } from './ui';

type Action = 'accept' | 'reject' | 'cancel' | 'share' | 'complete';

const DIALOGS: Record<Action, { title: string; body: string; confirm: string; danger?: boolean }> = {
  accept: { title: 'Accept this swap?', body: 'Both games will be reserved for this swap, and other pending offers for them will be rejected automatically.', confirm: 'Accept offer' },
  reject: { title: 'Reject this offer?', body: 'Your listing stays active. The sender can make another offer later.', confirm: 'Reject offer', danger: true },
  cancel: { title: 'Cancel your offer?', body: 'Both listings stay active. To offer a different game, send a new offer.', confirm: 'Cancel offer', danger: true },
  share: { title: 'Share your phone number?', body: 'Are you sure you want to share your phone number with your swap partner?', confirm: 'Share phone number' },
  complete: { title: 'Mark the swap as completed?', body: 'Confirm only after you have physically exchanged the games. The swap completes once both of you confirm.', confirm: 'Mark as completed' },
};

const RPC: Record<Action, string> = {
  accept: 'accept_offer', reject: 'reject_offer', cancel: 'cancel_offer', share: 'share_phone', complete: 'confirm_completion',
};

export function OfferCard({
  offer, viewerId, iShared, partnerShared, partnerPhone,
}: {
  offer: Offer;
  viewerId: string;
  iShared: boolean;
  partnerShared: boolean;
  partnerPhone: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSender = viewerId === offer.sender_id;
  const yours = isSender ? offer.offered : offer.target;
  const theirs = isSender ? offer.target : offer.offered;
  const partner = isSender ? offer.receiver : offer.sender;
  const myConfirmed = isSender ? offer.sender_confirmed_at : offer.receiver_confirmed_at;
  const partnerConfirmed = isSender ? offer.receiver_confirmed_at : offer.sender_confirmed_at;

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc(RPC[action], { p_offer: offer.id });
    setBusy(false);
    setPending(null);
    if (error) { setError(friendlyError(error)); router.refresh(); return; }
    router.refresh();
  }

  async function openChat() {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc('open_offer_conversation', { p_offer: offer.id });
    if (error) { setError(friendlyError(error)); setBusy(false); return; }
    router.push(`/messages/${data}`);
  }

  const canChat = offer.status === 'PENDING' || offer.status === 'ACCEPTED' || offer.status === 'COMPLETED';

  return (
    <article className="card offer-card">
      <div className="row-between">
        <OfferStatusBadge status={offer.status} />
        <span className="muted small">{formatDate(offer.created_at)}</span>
      </div>

      <div className="swap">
        <div className="swap-side yours">
          <div><GameCover game={yours.game} imageUrl={yours.image_url} small /></div>
          <div style={{ minWidth: 0 }}>
            <div className="who">Your game</div>
            <div className="title">{yours.game.title}</div>
            <PlatformBadge platform={yours.game.platform} />
          </div>
        </div>
        <div className="swap-arrow" aria-label="swapped for">↔</div>
        <div className="swap-side theirs">
          <div><GameCover game={theirs.game} imageUrl={theirs.image_url} small /></div>
          <div style={{ minWidth: 0 }}>
            <div className="who">Their game</div>
            <Link href={`/listings/${theirs.id}`} className="title">{theirs.game.title}</Link>
            <div><PlatformBadge platform={theirs.game.platform} /></div>
          </div>
        </div>
      </div>

      <div className="offer-meta">
        <span>Sender: {isSender ? 'You' : <Link href={`/u/${offer.sender.username}`}>{offer.sender.display_name}</Link>}</span>
        <span>Receiver: {isSender ? <Link href={`/u/${offer.receiver.username}`}>{offer.receiver.display_name}</Link> : 'You'}</span>
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}

      <div className="offer-actions">
        {offer.status === 'PENDING' && !isSender ? (
          <>
            <button className="btn btn-primary" onClick={() => setPending('accept')} disabled={busy}>Accept</button>
            <button className="btn btn-danger" onClick={() => setPending('reject')} disabled={busy}>Reject</button>
          </>
        ) : null}
        {offer.status === 'PENDING' && isSender ? (
          <button className="btn btn-danger" onClick={() => setPending('cancel')} disabled={busy}>Cancel offer</button>
        ) : null}
        {canChat ? <button className="btn btn-outline" onClick={openChat} disabled={busy}>Message {partner.display_name}</button> : null}
      </div>

      {offer.status === 'ACCEPTED' ? (
        <div className="swap-tools">
          <Notice kind="info">Both games are reserved for this swap. Arrange the exchange in your conversation, then confirm once it is done.</Notice>

          <div className="stack" style={{ gap: '.5rem' }}>
            <strong>Phone number (optional)</strong>
            {partnerShared && partnerPhone ? (
              <div>{partner.display_name}&apos;s number: <span className="phone-reveal">{partnerPhone}</span></div>
            ) : (
              <p className="muted small">{partner.display_name} has not shared a phone number.</p>
            )}
            {iShared ? (
              <p className="muted small">You shared your phone number with {partner.display_name}.</p>
            ) : (
              <div><button className="btn btn-outline btn-sm" onClick={() => setPending('share')} disabled={busy}>Share Phone Number</button></div>
            )}
          </div>

          <div className="stack" style={{ gap: '.5rem' }}>
            <strong>Finish the swap</strong>
            {myConfirmed ? (
              <p className="muted small">You confirmed. Waiting for {partner.display_name} to confirm too.</p>
            ) : (
              <div>
                <button className="btn btn-primary btn-sm" onClick={() => setPending('complete')} disabled={busy}>Mark as Completed</button>
                {partnerConfirmed ? <p className="muted small" style={{ marginTop: 6 }}>{partner.display_name} has already confirmed.</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {offer.status === 'COMPLETED' ? <Notice kind="success">Swap completed. Both listings are closed.</Notice> : null}
      {offer.status === 'REJECTED' && isSender ? <p className="muted small">This offer was rejected or the game became unavailable. You can send another offer if the listing is still active.</p> : null}

      {pending ? (
        <ConfirmDialog
          open
          title={DIALOGS[pending].title}
          confirmLabel={DIALOGS[pending].confirm}
          danger={DIALOGS[pending].danger}
          busy={busy}
          onConfirm={() => run(pending)}
          onCancel={() => setPending(null)}
        >
          {DIALOGS[pending].body}
        </ConfirmDialog>
      ) : null}
    </article>
  );
}
