'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import type { ListingLite, Message, Offer, PublicProfile } from '@/lib/types';
import { GameCover, ListingStatusBadge, Notice, OfferStatusBadge, PlatformBadge } from './ui';

export function Chat({
  conversationId, viewerId, other, listing, offers, initialMessages,
}: {
  conversationId: string;
  viewerId: string;
  other: PublicProfile;
  listing: ListingLite;
  offers: Offer[];
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc('mark_conversation_read', { p_conversation: conversationId }).then(() => router.refresh());

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== viewerId) supabase.rpc('mark_conversation_read', { p_conversation: conversationId });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `listing_id=eq.${listing.id}` }, () => router.refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error } = await createClient()
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: viewerId, message: body })
      .select('id,conversation_id,sender_id,message,created_at,read_at')
      .single();
    setSending(false);
    if (error || !data) { setError(friendlyError(error)); return; }
    setText('');
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
  }

  return (
    <div className="card chat">
      <div className="chat-context">
        <div style={{ width: 52 }}><GameCover game={listing.game} imageUrl={listing.image_url} small /></div>
        <div className="grow">
          <div className="small muted">About this listing from {other.display_name}</div>
          <strong>{listing.game.title}</strong>{' '}
          <PlatformBadge platform={listing.game.platform} />{' '}
          {listing.status !== 'ACTIVE' ? <ListingStatusBadge status={listing.status} /> : null}
        </div>
        <Link href={`/listings/${listing.id}`} className="btn btn-outline btn-sm">View listing</Link>
      </div>

      <div className="chat-offers">
        {offers.map((o) => (
          <div key={o.id} className="offer-strip">
            <OfferStatusBadge status={o.status} />
            <span>
              {o.status === 'PENDING' ? 'Offer sent: ' : o.status === 'ACCEPTED' ? 'Offer accepted: ' : o.status === 'REJECTED' ? 'Offer rejected: ' : o.status === 'COMPLETED' ? 'Swap completed: ' : 'Offer cancelled: '}
              {o.offered.game.title} ({o.offered.game.platform}) ↔ {o.target.game.title} ({o.target.game.platform})
            </span>
            <Link href="/offers" className="small" style={{ marginLeft: 'auto', textDecoration: 'underline' }}>Open offers</Link>
          </div>
        ))}
      </div>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? <p className="muted small" style={{ margin: 'auto' }}>Say hello and ask about {listing.game.title}.</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_id === viewerId ? 'me' : 'them'}`}>
            {m.message}
            <time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={send}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" maxLength={2000} aria-label="Message" />
        <button className="btn btn-primary" type="submit" disabled={sending || text.trim().length === 0}>Send</button>
      </form>
      {error ? <div style={{ padding: '0 .8rem .8rem' }}><Notice kind="error">{error}</Notice></div> : null}
    </div>
  );
}
