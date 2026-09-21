import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MakeOfferFlow, type OfferChoice } from '@/components/MakeOfferFlow';
import { EmptyState } from '@/components/ui';
import { LISTING_SELECT } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Listing } from '@/lib/types';

export const metadata = { title: 'Make an offer' };

export default async function OfferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ offer?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).maybeSingle();
  if (!data) notFound();
  const target = data as unknown as Listing;

  if (target.owner_id === user!.id) {
    return <EmptyState title="This is your own listing" action={<Link className="btn btn-outline" href={`/listings/${id}`}>Back to listing</Link>}>You cannot make an offer on your own game.</EmptyState>;
  }
  if (target.status !== 'ACTIVE') {
    return <EmptyState title="This game is not available" action={<Link className="btn btn-outline" href="/browse">Browse games</Link>}>It is already part of a swap, completed, or cancelled, so it cannot receive new offers.</EmptyState>;
  }

  const { data: mine } = await supabase.from('listings').select(LISTING_SELECT).eq('owner_id', user!.id).eq('status', 'ACTIVE').order('created_at', { ascending: false });
  const ownerWants = new Set(target.wanted.map((w) => w.game.id));
  const choices: OfferChoice[] = ((mine ?? []) as unknown as Listing[])
    .map((l) => ({ id: l.id, game: l.game, condition: l.condition, imageUrl: l.image_url, wantedByOwner: ownerWants.has(l.game.id) }))
    .sort((a, b) => Number(b.wantedByOwner) - Number(a.wantedByOwner));

  return (
    <div>
      <div className="page-head"><div><h1>Make an offer</h1><p>One of your games for one of theirs.</p></div></div>
      <MakeOfferFlow
        targetId={target.id}
        targetGame={target.game}
        targetImage={target.image_url}
        ownerName={target.owner.display_name}
        choices={choices}
        preselect={sp.offer}
      />
    </div>
  );
}
