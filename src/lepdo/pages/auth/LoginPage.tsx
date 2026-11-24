import { useState, type FormEvent } from 'react';
import { Navigate } from '@/lepdo/router';
import { Mail } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/format';
import { AccessIssue } from './Status';

type Mode = 'password' | 'link' | 'forgot' | 'signup' | 'seller';

export default function LoginPage() {
  const { session, profile, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!loading && session && profile) {
    if (profile.role === 'seller' && profile.seller_status !== 'approved') return <AccessIssue reason={profile.seller_status === 'rejected' ? 'seller-rejected' : 'seller-pending'} />;
    return <Navigate to={profile.role === 'customer' ? '/portal' : '/admin'} replace />;
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
      } else if (mode === 'signup' || mode === 'seller') {
        const { data, error } = await supabase.auth.signUp({ email: addr, password, options: { emailRedirectTo: `${window.location.origin}/${mode === 'seller' ? 'login' : 'portal'}`, data: mode === 'seller' ? { full_name: fullName.trim(), phone: phone.trim(), seller_signup: 'true' } : { full_name: fullName.trim(), company_name: company.trim(), self_signup: 'true' } } });
        if (error) throw error;
        if (!data.session) setSent(mode === 'seller' ? 'Seller registration submitted. Pending Approval. Please confirm your email; dashboard access requires admin approval.' : 'Account created. Please check your email to confirm, then sign in.');
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
        {mode === 'forgot' ? 'Reset your password' : mode === 'seller' ? 'Register as Seller' : mode === 'signup' ? 'Create customer account' : 'Sign in'}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {mode === 'forgot' ? 'We will email you a secure link.' : 'Welcome to LEPDO CONNECT.'}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {(mode === 'signup' || mode === 'seller') && (
          <>
            <Field label="Full name"><Input required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            {mode === 'seller' ? <Field label="Phone (optional)"><Input type="tel" autoComplete="tel" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} /></Field> : <Field label="Company name (optional)"><Input autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} /></Field>}
          </>
        )}
        <Field label="Email address">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        {(mode === 'password' || mode === 'signup' || mode === 'seller') && (
          <Field label="Password">
            <Input type="password" autoComplete={mode === 'signup' || mode === 'seller' ? 'new-password' : 'current-password'} minLength={mode === 'signup' || mode === 'seller' ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {sent && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sent}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          {mode === 'password' ? 'Sign in' : mode === 'seller' ? 'Submit seller registration' : mode === 'signup' ? 'Create account' : mode === 'link' ? 'Email me a sign-in link' : 'Send reset link'}
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
            <button className="text-left text-brand-indigo hover:underline" onClick={() => { setMode('signup'); setError(null); setSent(null); }}>
              New customer? Create an account
            </button>
            <Button variant="ghost" className="justify-start px-0" onClick={() => { setMode('seller'); setError(null); setSent(null); setPassword(''); }}>Register as Seller</Button>
          </>
        ) : (
          <button className="text-left text-brand-indigo hover:underline" onClick={() => { setMode('password'); setError(null); setSent(null); }}>
            ← Sign in with password
          </button>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        Access is by invitation from LEPDO. Need help? Contact your assigned LEPDO executive.
      </p>
    </AuthShell>
  );
}
