'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AREA_SUGGESTIONS, CITIES, PHONE_RE, USERNAME_RE, cleanPhone } from '@/lib/constants';
import type { PublicProfile } from '@/lib/types';
import { Avatar, Notice } from './ui';

export function ProfileForm({ profile, phone }: { profile: PublicProfile; phone: string }) {
  const router = useRouter();
  const [f, setF] = useState({ username: profile.username, display_name: profile.display_name, city: profile.city, area: profile.area, phone });
  const [avatar, setAvatar] = useState(profile.profile_image);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function uploadAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return setMsg({ kind: 'error', text: 'Choose an image up to 3 MB.' });
    setBusy(true);
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setMsg({ kind: 'error', text: 'The photo could not be uploaded. Try again.' }); }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from('profiles').update({ profile_image: url }).eq('id', profile.id);
    setBusy(false);
    if (error) return setMsg({ kind: 'error', text: 'Could not save your photo.' });
    setAvatar(url);
    setMsg({ kind: 'success', text: 'Profile photo updated.' });
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const username = f.username.trim().toLowerCase();
    const phoneClean = cleanPhone(f.phone);
    if (!USERNAME_RE.test(username)) return setMsg({ kind: 'error', text: 'Username must be 3 to 20 characters: lowercase letters, numbers or underscores.' });
    if (!f.display_name.trim() || !f.area.trim()) return setMsg({ kind: 'error', text: 'Display name and area are required.' });
    if (phoneClean && !PHONE_RE.test(phoneClean)) return setMsg({ kind: 'error', text: 'Enter a valid phone number, for example +201001234567.' });

    setBusy(true);
    const supabase = createClient();
    const p = await supabase.from('profiles').update({ username, display_name: f.display_name.trim(), city: f.city, area: f.area.trim() }).eq('id', profile.id);
    if (p.error) {
      setBusy(false);
      return setMsg({ kind: 'error', text: p.error.code === '23505' ? 'That username is taken. Try another one.' : 'Could not save your profile. Please try again.' });
    }
    const priv = await supabase.from('profile_private').update({ phone_number: phoneClean || null }).eq('id', profile.id);
    setBusy(false);
    if (priv.error) return setMsg({ kind: 'error', text: 'Your profile was saved, but the phone number could not be.' });
    setMsg({ kind: 'success', text: 'Saved.' });
    router.refresh();
  }

  return (
    <form className="stack-lg" onSubmit={save} style={{ maxWidth: 560 }}>
      <div className="row">
        <Avatar name={f.display_name || f.username} url={avatar} size={72} />
        <div className="field">
          <label htmlFor="avatar">Profile picture (optional)</label>
          <input id="avatar" type="file" accept="image/*" onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)} disabled={busy} />
        </div>
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="username">Username</label><input id="username" type="text" value={f.username} onChange={set('username')} maxLength={20} /></div>
        <div className="field"><label htmlFor="display_name">Display name</label><input id="display_name" type="text" value={f.display_name} onChange={set('display_name')} maxLength={50} /></div>
        <div className="field"><label htmlFor="city">City</label><select id="city" value={f.city} onChange={set('city')}>{!CITIES.includes(f.city) ? <option>{f.city}</option> : null}{CITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="area">Area</label><input id="area" type="text" list="areas" value={f.area} onChange={set('area')} maxLength={60} /><datalist id="areas">{AREA_SUGGESTIONS.map((a) => <option key={a} value={a} />)}</datalist></div>
      </div>
      <div className="field">
        <label htmlFor="phone">Phone number (private)</label>
        <input id="phone" type="tel" value={f.phone} onChange={set('phone')} placeholder="+201001234567" />
        <span className="help">Only you can see this. It is shared with a swap partner only if you press Share Phone Number on an accepted swap.</span>
      </div>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <div><button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" aria-hidden /> : null}Save changes</button></div>
    </form>
  );
}
