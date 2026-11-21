import { useState, type FormEvent } from 'react';
import { Navigate } from '@/lepdo/router';
import { Mail, LogIn } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../lib/demo';

type Mode = 'password' | 'link' | 'forgot';

export default function LoginPage() {
  const { session, profile, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!loading && session && profile) return <Navigate to={profile.role === 'customer' ? '/portal' : '/admin'} replace />;

  async function demoLogin(addr: string) {
    if (busy) return;
    setMode('password');
    setEmail(addr);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setSent(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password: DEMO_PASSWORD });
      if (error) throw error;
    } catch (err) {
      setError(errorMessage(err) || 'Demo sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSent(null);
    const addr = email.trim().toLowerCase();
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message);
      } else if (mode === 'link') {
        const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setSent('If this email has LEPDO CONNECT access, a sign-in link is on its way. Please check your inbox.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: `${window.location.origin}/set-password` });
        if (error) throw error;
        setSent('If this email has an account, we have sent a link to reset your password.');
      }
    } catch (err) {
      const msg = errorMessage(err) || 'Sign-in failed.';
      setError(/signups not allowed|not found/i.test(msg) ? 'This email does not have LEPDO CONNECT access yet. Please contact your LEPDO executive.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight text-brand-indigo">
        {mode === 'forgot' ? 'Reset your password' : 'Sign in'}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {mode === 'forgot' ? 'We will email you a secure link.' : 'Welcome to LEPDO CONNECT.'}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email address">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        {mode === 'password' && (
          <Field label="Password">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {sent && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sent}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          {mode === 'password' ? 'Sign in' : mode === 'link' ? 'Email me a sign-in link' : 'Send reset link'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-sm">
        {mode === 'password' ? (
          <>
            <button className="inline-flex items-center gap-2 text-brand-indigo hover:underline" onClick={() => { setMode('link'); setError(null); setSent(null); }}>
              <Mail className="h-4 w-4" /> Email me a sign-in link instead
            </button>
            <button className="text-left text-slate-500 hover:text-brand-indigo" onClick={() => { setMode('forgot'); setError(null); setSent(null); }}>
              Forgot password?
            </button>
          </>
        ) : (
          <button className="text-left text-brand-indigo hover:underline" onClick={() => { setMode('password'); setError(null); setSent(null); }}>
            ← Sign in with password
          </button>
        )}
      </div>

      <section aria-label="Demo accounts" className="mt-8 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-brand-indigo">Demo access</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.filter((account) => account.role !== 'team').map((account) => (
            <Button key={account.role} icon={<LogIn className="h-4 w-4" />} disabled={busy} onClick={() => demoLogin(account.email)}>
              Demo {account.label}
            </Button>
          ))}
        </div>
        <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.role} className="flex flex-wrap justify-between gap-x-2">
              <dt>{account.label}</dt><dd className="font-medium text-foreground">{account.email}</dd>
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-x-2 pt-1">
            <dt>Password for all accounts</dt><dd className="font-mono font-medium text-brand-indigo">{DEMO_PASSWORD}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Shared demo accounts. Do not add confidential information.</p>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        Access is by invitation from LEPDO. Need help? Contact your assigned LEPDO executive.
      </p>
    </AuthShell>
  );
}
