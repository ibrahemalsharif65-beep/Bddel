'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CONDITIONS } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import type { Condition, Game } from '@/lib/types';
import { GameCover, Notice, PlatformBadge } from './ui';

export interface OfferChoice {
  id: string;
  game: Game;
  condition: Condition;
  imageUrl: string | null;
  wantedByOwner: boolean;
}

export function MakeOfferFlow({
  targetId, targetGame, targetImage, ownerName, choices, preselect,
}: {
  targetId: string;
  targetGame: Game;
  targetImage: string | null;
  ownerName: string;
  choices: OfferChoice[];
  preselect?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(choices.some((c) => c.id === preselect) ? (preselect ?? null) : null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = choices.find((c) => c.id === selected);

  async function send() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    // The server derives sender, receiver and ownership itself; only the two listing ids are sent.
    const { error } = await createClient().rpc('create_offer', { p_target: targetId, p_offered: selected });
    if (error) { setError(friendlyError(error)); setBusy(false); return; }
    router.push('/offers?tab=sent&sent=1');
    router.refresh();
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 680 }}>
      <div className="card panel">
        <p className="muted small">You want</p>
        <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
          <div style={{ width: 64 }}><GameCover game={targetGame} imageUrl={targetImage} /></div>
          <div>
            <h2>{targetGame.title}</h2>
            <div className="row" style={{ marginTop: 4 }}><PlatformBadge platform={targetGame.platform} /><span className="muted small">owned by {ownerName}</span></div>
          </div>
        </div>
      </div>

      {step === 'select' ? (
        <div className="stack">
          <h2>Select one of your games to offer</h2>
          {choices.length === 0 ? (
            <div className="empty">
              <h3>You have no active listings to offer</h3>
              <p>An offer is one of your games for one of theirs. List a game first, then come back.</p>
              <Link href="/listings/new" className="btn btn-swap">List Your Game</Link>
            </div>
          ) : (
            <div className="pick-list">
              {choices.map((c) => (
                <button key={c.id} type="button" className="pick" aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>
                  <GameCover game={c.game} imageUrl={c.imageUrl} />
                  <div className="grow">
                    <strong>{c.game.title}</strong>
                    <div className="row" style={{ marginTop: 4 }}><PlatformBadge platform={c.game.platform} /><span className="muted small">{CONDITIONS[c.condition]}</span></div>
                  </div>
                  {c.wantedByOwner ? <span className="chip chip-match">{ownerName} is looking for this</span> : null}
                </button>
              ))}
            </div>
          )}
          <div className="row">
            <Link href={`/listings/${targetId}`} className="btn btn-outline">Cancel</Link>
            <button className="btn btn-primary" disabled={!selected} onClick={() => setStep('confirm')}>Continue</button>
          </div>
        </div>
      ) : chosen ? (
        <div className="stack">
          <h2>Confirm your offer</h2>
          <div className="swap">
            <div className="swap-side yours">
              <div style={{ width: 64 }}><GameCover game={chosen.game} imageUrl={chosen.imageUrl} /></div>
              <div><div className="who">You are offering</div><div className="title">{chosen.game.title}</div><PlatformBadge platform={chosen.game.platform} /></div>
            </div>
            <div className="swap-arrow" aria-hidden>↔</div>
            <div className="swap-side theirs">
              <div style={{ width: 64 }}><GameCover game={targetGame} imageUrl={targetImage} /></div>
              <div><div className="who">For</div><div className="title">{targetGame.title}</div><PlatformBadge platform={targetGame.platform} /></div>
            </div>
          </div>
          <p className="muted small">One game for one game. You can cancel the offer any time before it is accepted.</p>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <div className="row">
            <button className="btn btn-outline" onClick={() => setStep('select')} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? <span className="spinner" aria-hidden /> : null}Send Offer</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
