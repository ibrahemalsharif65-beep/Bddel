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

  // If the email already belongs to an existing account,
  // Supabase may return a user with no identities instead of an error.
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
