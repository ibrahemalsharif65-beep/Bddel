import Link from 'next/link';
import { OfferCard } from '@/components/OfferCard';
import { EmptyState, Notice } from '@/components/ui';
import { OFFER_SELECT } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Offer } from '@/lib/types';

export const metadata = { title: 'Offers' };

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string; sent?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const { data } = await supabase.from('offers').select(OFFER_SELECT).order('created_at', { ascending: false }).limit(200);
  const all = (data ?? []) as unknown as Offer[];
  const received = all.filter((o) => o.receiver_id === me);
  const sent = all.filter((o) => o.sender_id === me);
  const tab = sp.tab === 'sent' ? 'sent' : 'received';
  const shown = tab === 'sent' ? sent : received;

  // Phone sharing state for accepted swaps. The partner's number itself only comes back from the
  // get_partner_phone function, and only if they chose to share it for that specific offer.
  const active = shown.filter((o) => o.status === 'ACCEPTED');
  const { data: shares } = active.length
    ? await supabase.from('phone_shares').select('offer_id,user_id').in('offer_id', active.map((o) => o.id))
    : { data: [] };
  const shareSet = new Set((shares ?? []).map((s: { offer_id: string; user_id: string }) => `${s.offer_id}:${s.user_id}`));
  const phones = new Map<string, string | null>();
  await Promise.all(
    active.map(async (o) => {
      const partner = o.sender_id === me ? o.receiver_id : o.sender_id;
      if (!shareSet.has(`${o.id}:${partner}`)) return;
      const { data: phone } = await supabase.rpc('get_partner_phone', { p_offer: o.id });
      phones.set(o.id, (phone as string | null) ?? null);
    }),
  );

  const pendingReceived = received.filter((o) => o.status === 'PENDING').length;

  return (
    <div>
      <div className="page-head"><div><h1>Offers</h1><p>Every offer is one game for one game.</p></div></div>
      {sp.sent ? <div style={{ marginBottom: '1rem' }}><Notice kind="success">Offer sent. The owner can accept or reject it, and you can cancel it until then.</Notice></div> : null}

      <div className="tabs" role="tablist">
        <Link className="tab" href="/offers?tab=received" aria-current={tab === 'received' ? 'page' : undefined}>Received{pendingReceived > 0 ? <span className="count">{pendingReceived}</span> : null}</Link>
        <Link className="tab" href="/offers?tab=sent" aria-current={tab === 'sent' ? 'page' : undefined}>Sent</Link>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={tab === 'sent' ? 'You have not sent any offers' : 'No offers received yet'} action={<Link href="/browse" className="btn btn-primary">Browse games</Link>}>
          {tab === 'sent' ? 'Open a listing that wants one of your games and press Make Offer.' : 'When someone offers you a game for one of your listings, it shows up here.'}
        </EmptyState>
      ) : (
        <div className="stack">
          {shown.map((o) => {
            const partner = o.sender_id === me ? o.receiver_id : o.sender_id;
            return (
              <OfferCard
                key={o.id}
                offer={o}
                viewerId={me}
                iShared={shareSet.has(`${o.id}:${me}`)}
                partnerShared={shareSet.has(`${o.id}:${partner}`)}
                partnerPhone={phones.get(o.id) ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
