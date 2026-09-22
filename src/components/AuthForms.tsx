'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  AREA_SUGGESTIONS,
  CITIES,
  PHONE_RE,
  USERNAME_RE,
  cleanPhone,
} from '@/lib/constants';
import { authError } from '@/lib/errors';
import { Notice } from './ui';

function safeNext(next: string | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/browse';
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(authError(error));
      setBusy(false);
      return;
    }

    router.push(safeNext(next));
    router.refresh();
  }

  return (
    <form className="panel stack form-card" onSubmit={submit}>
      <h1>Log in</h1>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        Log in
      </button>

      <div className="row-between small">
        <Link href="/forgot-password" className="muted">
          Forgot your password?
        </Link>

        <Link href="/signup" className="muted">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();

  const [f, setF] = useState({
    email: '',
    password: '',
    username: '',
    display_name: '',
    city: 'Cairo',
    area: '',
    phone: '',
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const username = f.username.trim().toLowerCase();
    const phone = cleanPhone(f.phone);

    if (!USERNAME_RE.test(username)) {
      return setError(
        'Username must be 3 to 20 characters: lowercase letters, numbers or underscores.'
      );
    }

    if (f.password.length < 8) {
      return setError('Use a password with at least 8 characters.');
    }

    if (!f.display_name.trim() || !f.area.trim()) {
      return setError('Enter your display name and area.');
    }

    if (phone && !PHONE_RE.test(phone)) {
      return setError(
        'Enter a valid phone number, for example +201001234567, or leave it empty.'
      );
    }

    setBusy(true);

    const supabase = createClient();

    const { data: free } = await supabase.rpc('username_available', {
      p_username: username,
    });

    if (free === false) {
      setError('That username is taken. Try another one.');
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/browse`,
        data: {
          username,
          display_name: f.display_name.trim(),
          city: f.city,
          area: f.area.trim(),
          phone_number: phone,
        },
      },
    });

    if (error) {
      setError(authError(error));
      setBusy(false);
      return;
    }

    // Supabase may return no error when the email
    // already belongs to an existing account.
    if (data.user && data.user.identities?.length === 0) {
      setError(
        'An account with this email already exists. Please log in instead.'
      );
      setBusy(false);
      return;
    }

    if (data.session) {
      router.push('/browse');
      router.refresh();
      return;
    }

    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="panel stack form-card">
        <h1>Check your email</h1>

        <p className="muted">
          We sent a confirmation link to {f.email}. Open it to activate your
          account, then log in.
        </p>

        <Link href="/login" className="btn btn-primary">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form className="panel stack form-card" onSubmit={submit}>
      <h1>Create your account</h1>

      <div className="field">
        <label htmlFor="email">Email</label>

        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={f.email}
          onChange={set('email')}
        />

        <span className="help">Never shown to other users.</span>
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>

        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={f.password}
          onChange={set('password')}
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="username">Username</label>

          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={f.username}
            onChange={set('username')}
            placeholder="ahmed_92"
            maxLength={20}
          />
        </div>

        <div className="field">
          <label htmlFor="display_name">Display name</label>

          <input
            id="display_name"
            type="text"
            required
            value={f.display_name}
            onChange={set('display_name')}
            maxLength={50}
          />
        </div>

        <div className="field">
          <label htmlFor="city">City</label>

          <select id="city" value={f.city} onChange={set('city')}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="area">Area</label>

          <input
            id="area"
            type="text"
            list="areas"
            required
            value={f.area}
            onChange={set('area')}
            maxLength={60}
          />

          <datalist id="areas">
            {AREA_SUGGESTIONS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="field">
        <label htmlFor="phone">Phone number (optional)</label>

        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={f.phone}
          onChange={set('phone')}
          placeholder="+201001234567"
        />

        <span className="help">
          Private. Only shared with a swap partner if you choose to, after an
          offer is accepted.
        </span>
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        Create account
      </button>

      <p className="small muted">
        Already have an account?{' '}
        <Link href="/login" style={{ textDecoration: 'underline' }}>
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await createClient().auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }
    );

    setBusy(false);

    if (error) {
      return setError(authError(error));
    }

    setDone(true);
  }

  return (
    <form className="panel stack form-card" onSubmit={submit}>
      <h1>Reset your password</h1>

      {done ? (
        <Notice kind="success">
          If an account exists for {email}, a reset link is on its way. Check
          your inbox.
        </Notice>
      ) : (
        <>
          <p className="muted">
            Enter your email and we will send you a link to choose a new
            password.
          </p>

          <div className="field">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error ? <Notice kind="error">{error}</Notice> : null}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden /> : null}
            Send reset link
          </button>
        </>
      )}

      <Link href="/login" className="small muted">
        Back to log in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      return setError('Use a password with at least 8 characters.');
    }

    setBusy(true);
    setError(null);

    const { error } = await createClient().auth.updateUser({
      password,
    });

    if (error) {
      setError(authError(error));
      setBusy(false);
      return;
    }

    router.push('/browse');
    router.refresh();
  }

  return (
    <form className="panel stack form-card" onSubmit={submit}>
      <h1>Choose a new password</h1>

      <div className="field">
        <label htmlFor="password">New password</label>

        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        Save new password
      </button>
    </form>
  );
}
