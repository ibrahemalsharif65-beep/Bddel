'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AREA_SUGGESTIONS, CITIES, CONDITIONS } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import type { Condition, Game, Listing, PublicProfile } from '@/lib/types';
import { GamePicker } from './GamePicker';
import { ListingCard } from './ListingCard';
import { Notice } from './ui';

export interface ListingFormInitial {
  id: string;
  game: Game;
  condition: Condition;
  description: string;
  city: string;
  area: string;
  imageUrl: string | null;
  wanted: Game[];
}

const MAX_IMAGE = 5 * 1024 * 1024;

export function ListingForm({ owner, initial }: { owner: PublicProfile; initial?: ListingFormInitial }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [gameSel, setGameSel] = useState<Game[]>(initial ? [initial.game] : []);
  const [condition, setCondition] = useState<Condition>(initial?.condition ?? 'USED_GOOD');
  const [city, setCity] = useState(initial?.city ?? owner.city);
  const [area, setArea] = useState(initial?.area ?? owner.area);
  const [wanted, setWanted] = useState<Game[]>(initial?.wanted ?? []);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const game = gameSel[0];

  function onFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); setFilePreview(null); return; }
    if (!f.type.startsWith('image/')) return setError('Please choose an image file.');
    if (f.size > MAX_IMAGE) return setError('The image must be 5 MB or smaller.');
    setFile(f);
    setRemoveImage(false);
    setFilePreview(URL.createObjectURL(f));
  }

  function toPreview() {
    setError(null);
    if (!game) return setError('Choose the game you are listing.');
    if (!city.trim() || !area.trim()) return setError('Enter your city and area.');
    setStep('preview');
    window.scrollTo({ top: 0 });
  }

  async function publish() {
    if (!game) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      let imageUrl: string | null = removeImage ? null : (initial?.imageUrl ?? null);
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${owner.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from('listing-images').upload(path, file, { contentType: file.type });
        if (up.error) throw new Error('image upload failed');
        imageUrl = supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
      }
      const args = { p_condition: condition, p_description: description, p_city: city, p_area: area, p_image_url: imageUrl, p_wanted: wanted.map((g) => g.id) };
      if (initial) {
        const { error } = await supabase.rpc('update_listing', { p_listing: initial.id, ...args });
        if (error) throw error;
        router.push(`/listings/${initial.id}?updated=1`);
      } else {
        const { data, error } = await supabase.rpc('create_listing', { p_game_id: game.id, ...args });
        if (error) throw error;
        router.push(`/listings/${data}?published=1`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message === 'image upload failed' ? 'The photo could not be uploaded. Try a smaller image.' : friendlyError(e));
      setBusy(false);
    }
  }

  if (step === 'preview' && game) {
    const preview: Listing = {
      id: 'preview', owner_id: owner.id, status: 'ACTIVE', condition, description: description || null,
      image_url: removeImage ? null : (filePreview ?? initial?.imageUrl ?? null), city, area,
      created_at: new Date().toISOString(), game, owner,
      wanted: wanted.map((g) => ({ game: g })),
    };
    return (
      <div className="stack" style={{ maxWidth: 420 }}>
        <Notice>This is how your listing will look in Browse. Check it, then {editing ? 'save' : 'publish'}.</Notice>
        <ListingCard listing={preview} preview />
        {description ? <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{description}</p> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}
        <div className="row">
          <button className="btn btn-outline" onClick={() => setStep('form')} disabled={busy}>Back to edit</button>
          <button className="btn btn-primary" onClick={publish} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden /> : null}{editing ? 'Save changes' : 'Publish listing'}
          </button>
        </div>
      </div>
    );
  }

  const shownImage = removeImage ? null : (filePreview ?? initial?.imageUrl ?? null);

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      <div className="field">
        <span className="label">Game you are giving away</span>
        <GamePicker label="Your game" selected={gameSel} onChange={setGameSel} disabled={editing} />
        {editing ? <p className="help">The game cannot be changed after listing. Cancel this listing and create a new one instead.</p> : null}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="condition">Condition</label>
          <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
            {Object.entries(CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">Platform</span>
          <div className="row" style={{ minHeight: 44 }}>
            {game ? <span className={`platform ${game.platform.toLowerCase()}`}>{game.platform}</span> : <span className="muted small">Set by the game you choose</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
            {!CITIES.includes(city) && city ? <option value={city}>{city}</option> : null}
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="area">Area</label>
          <input id="area" type="text" list="area-list" value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} placeholder="e.g. Nasr City" />
          <datalist id="area-list">{AREA_SUGGESTIONS.map((a) => <option key={a} value={a} />)}</datalist>
        </div>
      </div>

      <div className="field">
        <span className="label">Games you would accept in exchange (optional)</span>
        <GamePicker
          label="Wanted games"
          selected={wanted}
          onChange={setWanted}
          multiple
          max={15}
          excludeIds={game ? [game.id] : []}
          hint="Any one of these is fine. Leave this empty if you are open to any offer: you will see who wants your game and every offer that comes in."
        />
      </div>

      <div className="field">
        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Scratches, editions, DLC codes, anything a swapper should know." />
      </div>

      <div className="field">
        <label htmlFor="photo">Photo of your disc (optional)</label>
        <input id="photo" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <p className="help">If you skip this, the game&apos;s cover is shown.</p>
        {shownImage ? (
          <div className="row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownImage} alt="Your upload" style={{ width: 90, borderRadius: 8 }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setFile(null); setFilePreview(null); setRemoveImage(true); }}>Remove photo</button>
          </div>
        ) : null}
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}
      <div className="row">
        <button className="btn btn-primary" onClick={toPreview}>Preview listing</button>
        <button className="btn btn-outline" onClick={() => router.back()}>Cancel</button>
      </div>
    </div>
  );
}
