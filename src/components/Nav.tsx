'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/messages', label: 'Messages', badge: 'unread' as const },
  { href: '/offers', label: 'Offers', badge: 'offers' as const },
  { href: '/my-listings', label: 'My Listings' },
  { href: '/profile', label: 'Profile' },
];

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
      <circle cx="12" cy="16" r="9" fill="none" stroke="#6d7dff" strokeWidth="3" />
      <circle cx="20" cy="16" r="9" fill="none" stroke="#ffb547" strokeWidth="3" />
    </svg>
  );
}

export function Nav({ loggedIn, unread, pendingOffers }: { loggedIn: boolean; unread: number; pendingOffers: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }

  const counts = { unread, offers: pendingOffers };

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand" aria-label="Baddel home">
          <BrandMark /> Baddel
        </Link>
        <nav className={`nav-links${open ? ' open' : ''}`} aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname === l.href || pathname.startsWith(l.href + '/');
            const n = l.badge ? counts[l.badge] : 0;
            return (
              <Link key={l.href} href={l.href} className="nav-link" aria-current={active ? 'page' : undefined}>
                {l.label}
                {n > 0 ? <span className="count" aria-label={`${n} new`}>{n}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="nav-actions">
          <Link href="/listings/new" className="btn btn-swap btn-sm">List Your Game</Link>
          {loggedIn ? (
            <button className="btn btn-outline btn-sm hide-sm" onClick={logout}>Log out</button>
          ) : (
            <Link href="/login" className="btn btn-outline btn-sm hide-sm">Log in</Link>
          )}
          <button className="btn btn-outline btn-sm menu-toggle" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      {open ? (
        <div className="container" style={{ height: 'auto', paddingBottom: '.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          {loggedIn ? <button className="btn btn-outline btn-sm" onClick={logout}>Log out</button> : <Link href="/login" className="btn btn-outline btn-sm">Log in</Link>}
        </div>
      ) : null}
    </header>
  );
}
