'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { ConfirmDialog } from './ConfirmDialog';
import { Notice } from './ui';

export function MessageUserButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc('start_conversation', { p_listing: listingId });
    if (error) { setError(friendlyError(error)); setBusy(false); return; }
    router.push(`/messages/${data}`);
  }

  return (
    <>
      <button className="btn btn-outline" onClick={open} disabled={busy}>{busy ? <span className="spinner" aria-hidden /> : null}Message User</button>
      {error ? <Notice kind="error">{error}</Notice> : null}
    </>
  );
}

export function CancelListingButton({ listingId, small = false }: { listingId: string; small?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    const { error } = await createClient().rpc('cancel_listing', { p_listing: listingId });
    setBusy(false);
    if (error) { setError(friendlyError(error)); setOpen(false); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-danger${small ? ' btn-sm' : ''}`} onClick={() => setOpen(true)}>Cancel listing</button>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <ConfirmDialog open={open} danger busy={busy} title="Cancel this listing?" confirmLabel="Cancel listing" cancelLabel="Keep listing" onConfirm={cancel} onCancel={() => setOpen(false)}>
        The listing will be removed from Browse and any pending offers involving it will be closed. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
