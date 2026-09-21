import Link from 'next/link';
import { Avatar, EmptyState, GameCover, PlatformBadge } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { LISTING_LITE, PROFILE_FIELDS } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { ListingLite, PublicProfile } from '@/lib/types';

export const metadata = { title: 'Messages' };

interface ConvRow {
  conversation_id: string;
  listing_id: string;
  other_user_id: string;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_conversations');
  const convs = (data ?? []) as ConvRow[];

  const [{ data: ls }, { data: ps }] = convs.length
    ? await Promise.all([
        supabase.from('listings').select(LISTING_LITE).in('id', convs.map((c) => c.listing_id)),
        supabase.from('profiles').select(PROFILE_FIELDS).in('id', convs.map((c) => c.other_user_id)),
      ])
    : [{ data: [] }, { data: [] }];
  const listings = new Map(((ls ?? []) as unknown as ListingLite[]).map((l) => [l.id, l]));
  const profiles = new Map(((ps ?? []) as PublicProfile[]).map((p) => [p.id, p]));

  return (
    <div>
      <div className="page-head"><div><h1>Messages</h1><p>Every conversation is about one specific listing.</p></div></div>
      {convs.length === 0 ? (
        <EmptyState title="No conversations yet" action={<Link href="/browse" className="btn btn-primary">Browse games</Link>}>
          Open a listing and press Message User to ask the owner about it.
        </EmptyState>
      ) : (
        <div className="stack">
          {convs.map((c) => {
            const l = listings.get(c.listing_id);
            const p = profiles.get(c.other_user_id);
            if (!l || !p) return null;
            return (
              <Link key={c.conversation_id} href={`/messages/${c.conversation_id}`} className="card conv-item">
                <div style={{ width: 52 }}><GameCover game={l.game} imageUrl={l.image_url} small /></div>
                <Avatar name={p.display_name} url={p.profile_image} size={36} />
                <div className="grow">
                  <div className="row" style={{ gap: '.5rem' }}><strong>{p.display_name}</strong><span className="muted small">about {l.game.title}</span><PlatformBadge platform={l.game.platform} /></div>
                  <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last_message ?? 'No messages yet'}</div>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="muted small">{timeAgo(c.last_message_at)}</span>
                  {Number(c.unread_count) > 0 ? <span className="unread">{Number(c.unread_count)}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
