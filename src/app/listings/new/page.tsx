import { ListingForm } from '@/components/ListingForm';
import { Notice } from '@/components/ui';
import { PROFILE_FIELDS } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { PublicProfile } from '@/lib/types';

export const metadata = { title: 'List your game' };

export default async function NewListingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', user!.id).single();

  return (
    <div>
      <div className="page-head"><div><h1>List your game</h1><p>Pick the disc you are giving away. Choosing games you want back is optional.</p></div></div>
      {!profile ? (
        <Notice kind="error">Your profile could not be loaded. Please try again later.</Notice>
      ) : (
        <ListingForm owner={profile as PublicProfile} />
      )}
    </div>
  );
}
