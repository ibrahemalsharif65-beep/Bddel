'use client';

import { EmptyState } from '@/components/ui';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState title="Something went wrong" action={<button className="btn btn-primary" onClick={reset}>Try again</button>}>
      The page could not be loaded. Check your connection and try again.
    </EmptyState>
  );
}
