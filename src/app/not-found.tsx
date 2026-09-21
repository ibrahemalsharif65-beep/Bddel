import Link from 'next/link';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <EmptyState title="We could not find that page" action={<Link href="/browse" className="btn btn-primary">Browse games</Link>}>
      The link may be old, or the listing or conversation is not available to you.
    </EmptyState>
  );
}
