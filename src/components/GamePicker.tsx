'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { GAME_FIELDS } from '@/lib/queries';
import type { Game, Platform } from '@/lib/types';
import { GameCover, Notice, PlatformBadge } from './ui';

/**
 * Searches the games catalogue on the server as you type (the catalogue can hold thousands of titles).
 * If the game is missing, the person can add it and it joins the shared catalogue.
 */
export function GamePicker({
  selected, onChange, multiple = false, max = 15, excludeIds = [], disabled = false, label, hint,
}: {
  selected: Game[];
  onChange: (games: Game[]) => void;
  multiple?: boolean;
  max?: number;
  excludeIds?: string[];
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<'' | Platform>('');
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState<Platform>('PS5');
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const seq = useRef(0);

  const term = q.trim();

  useEffect(() => {
    if (disabled || term.length < 2) { setResults([]); setLoading(false); setSearchError(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      // "spider man 2" should find "Marvel's Spider-Man 2": words become % wildcards.
      const pattern = '%' + term.replace(/[%,()*\\]/g, ' ').split(/\s+/).filter(Boolean).join('%') + '%';
      let query = createClient().from('games').select(GAME_FIELDS).ilike('title', pattern).order('title').limit(30);
      if (platform) query = query.eq('platform', platform);
      const { data, error } = await query;
      if (mine !== seq.current) return;
      setLoading(false);
      setSearchError(Boolean(error));
      setResults(error ? [] : ((data ?? []) as Game[]));
    }, 250);
    return () => clearTimeout(t);
  }, [term, platform, disabled]);

  const selectedIds = selected.map((g) => g.id);
  const visible = results.filter((g) => !excludeIds.includes(g.id));

  function toggle(g: Game) {
    if (disabled) return;
    if (!multiple) return onChange([g]);
    if (selectedIds.includes(g.id)) return onChange(selected.filter((x) => x.id !== g.id));
    if (selected.length >= max) return;
    onChange([...selected, g]);
  }

  function openAdd() {
    setNewTitle(term);
    setNewPlatform(platform || 'PS5');
    setAddError(null);
    setAdding(true);
  }

  async function addGame() {
    setBusy(true);
    setAddError(null);
    const { data, error } = await createClient().rpc('add_game', { p_title: newTitle, p_platform: newPlatform });
    setBusy(false);
    if (error || !data) { setAddError(friendlyError(error)); return; }
    const game = data as Game;
    if (excludeIds.includes(game.id)) { setAddError('That is the game you are listing. Pick a different one.'); return; }
    if (!multiple) onChange([game]);
    else if (!selectedIds.includes(game.id) && selected.length < max) onChange([...selected, game]);
    setAdding(false);
    setQ('');
  }

  return (
    <div className="picker" aria-label={label}>
      {selected.length > 0 ? (
        <div className="chips">
          {selected.map((g) => (
            <span key={g.id} className="chip chip-want">
              {g.title} <span className="muted">{g.platform}</span>
              {!disabled ? <button type="button" aria-label={`Remove ${g.title}`} onClick={() => onChange(selected.filter((x) => x.id !== g.id))}>×</button> : null}
            </span>
          ))}
        </div>
      ) : null}

      {!disabled ? (
        <>
          <div className="picker-tools">
            <input type="search" placeholder="Type a game title to search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`${label}: search`} />
            <select value={platform} onChange={(e) => setPlatform(e.target.value as '' | Platform)} aria-label={`${label}: platform`} style={{ width: 'auto' }}>
              <option value="">PS4 + PS5</option>
              <option value="PS5">PS5</option>
              <option value="PS4">PS4</option>
            </select>
          </div>

          {term.length < 2 ? <p className="help">Type at least 2 letters to search the catalogue.</p> : null}
          {loading ? <p className="help">Searching…</p> : null}
          {searchError ? <Notice kind="error">Search failed. Check your connection and try again.</Notice> : null}

          {visible.length > 0 ? (
            <div className="picker-list" role="listbox" aria-multiselectable={multiple}>
              {visible.map((g) => (
                <button type="button" key={g.id} className="picker-item" aria-pressed={selectedIds.includes(g.id)} onClick={() => toggle(g)}>
                  <GameCover game={g} small />
                  <span className="grow">{g.title}</span>
                  <PlatformBadge platform={g.platform} />
                </button>
              ))}
            </div>
          ) : null}
          {!loading && term.length >= 2 && !searchError && visible.length === 0 ? <p className="help">No game found for “{term}”.</p> : null}

          {adding ? (
            <div className="stack" style={{ gap: '.5rem', borderTop: '1px dashed var(--line)', paddingTop: '.6rem' }}>
              <strong className="small">Add a game that is not in the list</strong>
              <div className="picker-tools">
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Full game title" maxLength={100} aria-label="New game title" />
                <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value as Platform)} aria-label="New game platform" style={{ width: 'auto' }}>
                  <option value="PS5">PS5</option>
                  <option value="PS4">PS4</option>
                </select>
              </div>
              {addError ? <Notice kind="error">{addError}</Notice> : null}
              <div className="row">
                <button type="button" className="btn btn-primary btn-sm" onClick={addGame} disabled={busy || newTitle.trim().length < 2}>
                  {busy ? <span className="spinner" aria-hidden /> : null}Add game
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(false)} disabled={busy}>Cancel</button>
              </div>
            </div>
          ) : (
            <div><button type="button" className="btn btn-outline btn-sm" onClick={openAdd}>Can&apos;t find it? Add the game yourself</button></div>
          )}
        </>
      ) : null}

      {hint ? <p className="help">{hint}</p> : null}
      {multiple && !disabled ? <p className="help">{selected.length} of {max} selected.</p> : null}
    </div>
  );
}
