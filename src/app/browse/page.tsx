import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/ui';
import { CITIES } from '@/lib/constants';
import { computeMatch } from '@/lib/matching';
import { LISTING_SELECT_FILTERABLE } from '@/lib/queries';
import { getMyMatchData } from '@/lib/server-data';
import { createClient } from '@/lib/supabase/server';
import type { Listing } from '@/lib/types';

export const metadata = { title: 'Browse games' };
const PAGE_SIZE = 24;

export default async function BrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').replace(/[%,()*]/g, ' ').trim();
  const platform = sp.platform === 'PS4' || sp.platform === 'PS5' ? sp.platform : '';
  const city = sp.city ?? '';
  const area = sp.area ?? '';
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from('listings').select(LISTING_SELECT_FILTERABLE, { count: 'exact' }).eq('status', 'ACTIVE');
  if (q) query = query.ilike('game.title', `%${q}%`);
  if (platform) query = query.eq('game.platform', platform);
  if (city) query = query.eq('city', city);
  if (area) query = query.eq('area', area);
  const from = (page - 1) * PAGE_SIZE;

  const areaQuery = supabase.from('listings').select('area').eq('status', 'ACTIVE');
  const [{ data, count, error }, { data: areaRows }, mine] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
    city ? areaQuery.eq('city', city) : areaQuery,
    getMyMatchData(supabase, user?.id ?? null),
  ]);

  const listings = (data ?? []) as unknown as Listing[];
  const areas = [...new Set((areaRows ?? []).map((r: { area: string }) => r.area))].sort();
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (platform) params.set('platform', platform);
    if (city) params.set('city', city);
    if (area) params.set('area', area);
    params.set('page', String(p));
    return `/browse?${params.toString()}`;
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Browse games</h1>
          <p>Find a listing that wants something you own.</p>
        </div>
        <Link href="/listings/new" className="btn btn-swap">List Your Game</Link>
      </div>

      <form className="card filters" method="get" action="/browse">
        <div className="field"><label htmlFor="q">Game title</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Search by title" /></div>
        <div className="field">
          <label htmlFor="platform">Platform</label>
          <select id="platform" name="platform" defaultValue={platform}><option value="">PS4 + PS5</option><option value="PS5">PS5</option><option value="PS4">PS4</option></select>
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <select id="city" name="city" defaultValue={city}><option value="">All cities</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="area">Area</label>
          <select id="area" name="area" defaultValue={area}><option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
        </div>
        <button className="btn btn-primary">Search</button>
      </form>

      {error ? (
        <EmptyState title="Listings could not be loaded">Please refresh the page and try again.</EmptyState>
      ) : listings.length === 0 ? (
        <EmptyState title="No games match these filters" action={<Link href="/browse" className="btn btn-outline">Clear filters</Link>}>
          Try a shorter title, another area, or check back soon. New listings appear here as soon as they are published.
        </EmptyState>
      ) : (
        <>
          <p className="muted small" style={{ marginBottom: '.75rem' }}>{total} {total === 1 ? 'game' : 'games'} available</p>
          <div className="grid-cards">
            {listings.map((l) => <ListingCard key={l.id} listing={l} match={computeMatch(l, mine, user?.id ?? null)} />)}
          </div>
          {pages > 1 ? (
            <nav className="pager" aria-label="Pages">
              {page > 1 ? <Link className="btn btn-outline btn-sm" href={link(page - 1)}>Previous</Link> : null}
              <span className="muted small">Page {page} of {pages}</span>
              {page < pages ? <Link className="btn btn-outline btn-sm" href={link(page + 1)}>Next</Link> : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
