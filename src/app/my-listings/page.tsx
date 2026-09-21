import Link from 'next/link';
import { CancelListingButton } from '@/components/ListingActions';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/ui';
import { LISTING_SELECT } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Listing, ListingStatus } from '@/lib/types';

export const metadata = { title: 'My listings' };

const GROUPS: { status: ListingStatus; title: string }[] = [
  { status: 'ACTIVE', title: 'Active' },
  { status: 'SWAP_PENDING', title: 'Swap pending' },
  { status: 'COMPLETED', title: 'Completed' },
  { status: 'CANCELLED', title: 'Cancelled' },
];

export default async function MyListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('owner_id', user!.id).order('created_at', { ascending: false });
  const listings = (data ?? []) as unknown as Listing[];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div><h1>My listings</h1><p>Statuses change automatically as your swaps progress.</p></div>
        <Link href="/listings/new" className="btn btn-swap">List Your Game</Link>
      </div>
      {listings.length === 0 ? (
        <EmptyState title="You have not listed any games" action={<Link href="/listings/new" className="btn btn-swap">List Your Game</Link>}>
          List a disc you no longer play and pick the games you would like instead.
        </EmptyState>
      ) : (
        GROUPS.map(({ status, title }) => {
          const items = listings.filter((l) => l.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className="stack">
              <h2>{title} ({items.length})</h2>
              <div className="grid-cards">
                {items.map((l) => (
                  <div key={l.id} className="stack" style={{ gap: '.5rem' }}>
                    <ListingCard listing={l} />
                    {status === 'ACTIVE' ? (
                      <div className="row">
                        <Link href={`/listings/${l.id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
                        <CancelListingButton listingId={l.id} small />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
