import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chat } from '@/components/Chat';
import { LISTING_LITE, OFFER_SELECT, PROFILE_FIELDS } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { ListingLite, Message, Offer, PublicProfile } from '@/lib/types';

export const metadata = { title: 'Conversation' };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Row level security only returns conversations the current user takes part in.
  const { data: conv } = await supabase
    .from('conversations')
    .select(`id,listing_id,initiator_id,owner_id,listing:listings!listing_id(${LISTING_LITE}),initiator:profiles!initiator_id(${PROFILE_FIELDS}),owner:profiles!owner_id(${PROFILE_FIELDS})`)
    .eq('id', id)
    .maybeSingle();
  if (!conv) notFound();

  const c = conv as unknown as { id: string; listing_id: string; initiator_id: string; owner_id: string; listing: ListingLite; initiator: PublicProfile; owner: PublicProfile };
  const other = c.initiator_id === user!.id ? c.owner : c.initiator;

  const [{ data: msgs }, { data: offers }] = await Promise.all([
    supabase.from('messages').select('id,conversation_id,sender_id,message,created_at,read_at').eq('conversation_id', id).order('created_at', { ascending: true }).limit(500),
    supabase.from('offers').select(OFFER_SELECT).eq('listing_id', c.listing_id).eq('sender_id', c.initiator_id).order('created_at', { ascending: true }),
  ]);

  return (
    <div className="stack">
      <Link href="/messages" className="muted small">Back to messages</Link>
      <Chat
        conversationId={id}
        viewerId={user!.id}
        other={other}
        listing={c.listing}
        offers={(offers ?? []) as unknown as Offer[]}
        initialMessages={(msgs ?? []) as Message[]}
      />
    </div>
  );
}
