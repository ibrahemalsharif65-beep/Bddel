import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { Nav } from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: { default: 'Baddel: swap PlayStation games in Egypt', template: '%s | Baddel' },
  description: 'List the PS4 or PS5 game you are done with, say which games you want, and swap discs one for one with people near you.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101326' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let unread = 0;
  let pendingOffers = 0;
  if (user) {
    const [u, o] = await Promise.all([
      supabase.rpc('unread_message_count'),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('status', 'PENDING'),
    ]);
    unread = Number(u.data ?? 0);
    pendingOffers = o.count ?? 0;
  }

  return (
    <html lang="en">
      <body>
        <Nav loggedIn={Boolean(user)} unread={unread} pendingOffers={pendingOffers} />
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container row-between">
            <span>Baddel. Swap physical PlayStation games, one for one.</span>
            <Link href="/browse">Browse games</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
