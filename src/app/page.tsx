import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/ui';
import { computeMatch } from '@/lib/matching';
import { LISTING_SELECT } from '@/lib/queries';
import { getMyMatchData } from '@/lib/server-data';
import { createClient } from '@/lib/supabase/server';
import type { Listing } from '@/lib/types';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data }, mine] = await Promise.all([
    supabase.from('listings').select(LISTING_SELECT).eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(8),
    getMyMatchData(supabase, user?.id ?? null),
  ]);
  const listings = (data ?? []) as unknown as Listing[];

  return (
    <div className="stack-lg">
      <section className="hero">
        <div>
          <h1>Trade the game you finished for the one you want next.</h1>
          <p className="lead">List a PS4 or PS5 disc, say which games you would take in return, and swap one for one with someone near you. No selling, no shipping, no cash.</p>
          <div className="row">
            <Link href="/listings/new" className="btn btn-swap">List Your Game</Link>
            <Link href="/browse" className="btn btn-outline">Browse games</Link>
          </div>
        </div>
        <div className="discs" aria-hidden>
          <div className="disc a"><span>Your game</span></div>
          <div className="disc-arrows">↔</div>
          <div className="disc b"><span>Their game</span></div>
        </div>
      </section>

      <section className="flow" aria-label="How it works">
        <div className="flow-step"><h3>Discover</h3><p>Find listings that want a game you own.</p></div>
        <div className="flow-step"><h3>Message</h3><p>Ask the owner about that exact listing.</p></div>
        <div className="flow-step"><h3>Offer</h3><p>Propose one of your games for theirs.</p></div>
        <div className="flow-step"><h3>Swap</h3><p>Meet up, exchange discs, confirm together.</p></div>
      </section>

      <section className="stack">
        <div className="row-between"><h2>Latest listings</h2><Link href="/browse" className="muted">See all</Link></div>
        {listings.length === 0 ? (
          <EmptyState title="No games listed yet" action={<Link href="/listings/new" className="btn btn-swap">List the first game</Link>}>
            Be the first to list a disc and choose what you want in return.
          </EmptyState>
        ) : (
          <div className="grid-cards">
            {listings.map((l) => <ListingCard key={l.id} listing={l} match={computeMatch(l, mine, user?.id ?? null)} />)}
          </div>
        )}
      </section>
    </div>
  );
}
