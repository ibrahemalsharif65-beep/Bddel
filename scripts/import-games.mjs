#!/usr/bin/env node
/**
 * Fills the `games` table with (almost) every PS4 and PS5 game, using IGDB (free with a Twitch account).
 * The PlayStation Store has no public catalogue API, and IGDB is the closest complete source that
 * also provides real box art.
 *
 * 1. Create a Twitch app at https://dev.twitch.tv/console/apps (category: Website Integration)
 *    and copy its Client ID and Client Secret.
 * 2. Put these in .env.local (never commit this file, never prefix the service key with NEXT_PUBLIC_):
 *      IGDB_CLIENT_ID=...
 *      IGDB_CLIENT_SECRET=...
 *      SUPABASE_SERVICE_ROLE_KEY=...      (Project Settings > API > service_role)
 *      NEXT_PUBLIC_SUPABASE_URL=...
 * 3. Run:  npm run import:games            (or add --dry-run to only count what would be added)
 *
 * Safe to re-run: games already in the table (same title + platform, ignoring case) are skipped.
 * Editions, DLC, expansions and bundles are excluded; only the base games/remasters are imported.
 */
import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry-run');
const PLATFORMS = [
  { id: 48, name: 'PS4' },
  { id: 167, name: 'PS5' },
];
const PAGE = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (title, platform) => `${title.replace(/\s+/g, ' ').trim().toLowerCase()}|${platform}`;

function need(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name}. See the header of scripts/import-games.mjs.`); process.exit(1); }
  return v;
}

async function igdbToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${need('IGDB_CLIENT_ID')}&client_secret=${need('IGDB_CLIENT_SECRET')}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch auth failed (${res.status}). Check IGDB_CLIENT_ID / IGDB_CLIENT_SECRET.`);
  return (await res.json()).access_token;
}

async function* igdbGames(token, platformId) {
  for (let offset = 0; ; offset += PAGE) {
    const body =
      `fields name, first_release_date, cover.image_id; ` +
      `where platforms = (${platformId}) & parent_game = null & version_parent = null & first_release_date != null; ` +
      `sort id asc; limit ${PAGE}; offset ${offset};`;
    let rows;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': process.env.IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body,
      });
      if (res.ok) { rows = await res.json(); break; }
      if (attempt >= 5) throw new Error(`IGDB request failed (${res.status}): ${await res.text()}`);
      await sleep(1000 * attempt); // rate limit (4 req/s) or a transient error
    }
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < PAGE) return;
    await sleep(300);
  }
}

async function existingKeys(supabase) {
  const seen = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('games').select('title,platform').range(from, from + 999);
    if (error) throw error;
    data.forEach((g) => seen.add(key(g.title, g.platform)));
    if (data.length < 1000) break;
  }
  return seen;
}

async function main() {
  const supabase = DRY
    ? null
    : createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const seen = DRY ? new Set() : await existingKeys(supabase);
  const token = await igdbToken();
  const now = Date.now() / 1000;
  let added = 0, skipped = 0;

  for (const p of PLATFORMS) {
    for await (const rows of igdbGames(token, p.id)) {
      const batch = [];
      for (const g of rows) {
        const title = String(g.name ?? '').replace(/\s+/g, ' ').trim();
        if (title.length < 2 || title.length > 200 || g.first_release_date > now) { skipped++; continue; }
        const k = key(title, p.name);
        if (seen.has(k)) { skipped++; continue; }
        seen.add(k);
        batch.push({
          title,
          platform: p.name,
          cover_image: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
        });
      }
      if (!DRY && batch.length) {
        const { error } = await supabase.from('games').insert(batch);
        if (error) {
          // one odd row should not stop the import: retry row by row
          for (const row of batch) {
            const r = await supabase.from('games').insert(row);
            if (r.error) { skipped++; continue; }
            added++;
          }
          continue;
        }
      }
      added += batch.length;
      console.log(`${p.name}: +${batch.length} (total added ${added}, skipped ${skipped})`);
    }
  }
  console.log(`${DRY ? '[dry run] would add' : 'Added'} ${added} games. Skipped ${skipped} (duplicates, unreleased or invalid).`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
