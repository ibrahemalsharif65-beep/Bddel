import Link from 'next/link';
import { ProfileForm } from '@/components/ProfileForm';
import { createClient } from '@/lib/supabase/server';
import type { PublicProfile } from '@/lib/types';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('id,username,display_name,profile_image,city,area').eq('id', user!.id).single(),
    supabase.from('profile_private').select('phone_number').eq('id', user!.id).maybeSingle(),
  ]);
  if (!profile) return <p className="muted">Your profile could not be loaded.</p>;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div><h1>Your profile</h1><p>Others see your username, display name, photo, city, area and active listings.</p></div>
        <Link href={`/u/${profile.username}`} className="btn btn-outline">View public profile</Link>
      </div>
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="small muted">Email (private)</div>
        <div>{user!.email}</div>
      </div>
      <ProfileForm profile={profile as PublicProfile} phone={priv?.phone_number ?? ''} />
    </div>
  );
}
