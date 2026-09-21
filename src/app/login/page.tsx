import { LoginForm } from '@/components/AuthForms';
import { Notice } from '@/components/ui';

export const metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="stack">
      {sp.error === 'link' ? <div className="form-card"><Notice kind="error">That link is invalid or has expired. Request a new one.</Notice></div> : null}
      <LoginForm next={sp.next} />
    </div>
  );
}
