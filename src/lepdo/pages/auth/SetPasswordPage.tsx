import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from '@/lepdo/router';
import AuthShell from './AuthShell';
import { Button, Field, Input, PageLoader } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

/** Landing page for invitation and password-recovery links. */
export default function SetPasswordPage() {
  const { session, profile, refreshProfile, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);
  const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');
  const [confirmedRecovery] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery');
  const recoveryReady = confirmedRecovery || isPasswordRecovery;
  const recoveryPage = window.location.pathname === '/reset-password';

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (recoveryPage && !recoveryReady) return setError('Open the password change link sent to your email address.');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    await refreshProfile();
    navigate(profile?.role === 'customer' ? '/portal' : '/', { replace: true });
  }

  if (!session && !waited && !linkError) return <PageLoader />;

  if (!session) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold text-brand-indigo">Link expired</h2>
        <p className="mt-2 text-sm text-slate-600">{linkError || 'This invitation or reset link is no longer valid. Links can be used once and expire after a short time.'}</p>
        <p className="mt-4 text-sm text-slate-600">Request a new link from the sign-in page, or ask your LEPDO executive to resend your invitation.</p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-indigo hover:underline">Go to sign in →</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight text-brand-indigo">Set your password</h2>
      <p className="mt-1 text-sm text-slate-500">For <strong className="text-slate-700">{session.user.email}</strong>. You will use it to sign in next time.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirm password">
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>Save password &amp; continue</Button>
      </form>
      <button className="mt-4 text-sm text-slate-500 hover:text-brand-indigo" onClick={() => navigate('/', { replace: true })}>Skip for now</button>
    </AuthShell>
  );
}
