import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/AuthForms';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a new password' };

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/forgot-password');
  return <ResetPasswordForm />;
}
