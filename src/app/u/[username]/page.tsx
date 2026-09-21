import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import { Avatar, EmptyState } from '@/components/ui';
import { computeMatch } from '@/lib/matching';
import { LISTING_SELECT, PROFILE_FIELDS } from '@/lib/queries';
import { getMyMatchData } from '@/lib/server-data';
import { createClient } from '@/lib/supabase/server';
import type { Listing, PublicProfile } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('username', username.toLowerCase()).maybeSingle();
  if (!profile) notFound();
  const p = profile as PublicProfile;

  const [{ data }, mine] = await Promise.all([
    supabase.from('listings').select(LISTING_SELECT).eq('owner_id', p.id).eq('status', 'ACTIVE').order('created_at', { ascending: false }),
    getMyMatchData(supabase, user?.id ?? null),
  ]);
  const listings = (data ?? []) as unknown as Listing[];

  return (
    <div className="stack-lg">
      <div className="row" style={{ gap: '1rem' }}>
        <Avatar name={p.display_name} url={p.profile_image} size={72} />
        <div>
          <h1>{p.display_name}</h1>
          <p className="muted">@{p.username} · {p.city}, {p.area}</p>
        </div>
      </div>
      <section className="stack">
        <h2>Active listings</h2>
        {listings.length === 0 ? (
          <EmptyState title="No active listings">{p.display_name} has no games available for swapping right now.</EmptyState>
        ) : (
          <div className="grid-cards">{listings.map((l) => <ListingCard key={l.id} listing={l} match={computeMatch(l, mine, user?.id ?? null)} />)}</div>
        )}
      </section>
    </div>
  );
}
