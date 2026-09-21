import { notFound, redirect } from 'next/navigation';
import { ListingForm } from '@/components/ListingForm';
import { LISTING_SELECT, PROFILE_FIELDS } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Listing, PublicProfile } from '@/lib/types';

export const metadata = { title: 'Edit listing' };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).maybeSingle();
  const l = data as unknown as Listing | null;
  if (!l || l.owner_id !== user!.id) notFound();
  if (l.status !== 'ACTIVE') redirect(`/listings/${id}`);

  const { data: profile } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', user!.id).single();

  return (
    <div>
      <div className="page-head"><div><h1>Edit listing</h1></div></div>
      <ListingForm
        owner={profile as PublicProfile}
        initial={{
          id: l.id, game: l.game, condition: l.condition, description: l.description ?? '',
          city: l.city, area: l.area, imageUrl: l.image_url, wanted: l.wanted.map((w) => w.game),
        }}
      />
    </div>
  );
}
