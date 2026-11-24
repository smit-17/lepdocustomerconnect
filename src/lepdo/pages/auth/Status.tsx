import AuthShell from './AuthShell';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export function AccessIssue({ reason }: { reason: 'inactive' | 'no-customer' | 'seller-pending' | 'seller-rejected' }) {
  const { signOut, session } = useAuth();
  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold text-brand-indigo">{reason === 'seller-pending' ? 'Pending Approval' : reason === 'seller-rejected' ? 'Seller request rejected' : reason === 'inactive' ? 'Account not active' : 'Portal access is being set up'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {reason === 'seller-pending' ? 'Your seller registration is awaiting admin approval.' : reason === 'seller-rejected' ? 'Your seller registration was rejected. Please contact LEPDO.' : reason === 'inactive'
          ? 'This account has been deactivated or is not yet linked to LEPDO CONNECT. Please contact LEPDO if you believe this is a mistake.'
          : 'Your account is not yet linked to a customer record. Your LEPDO executive will complete this shortly.'}
      </p>
      {session && <p className="mt-4 text-xs text-slate-500">Signed in as {session.user.email}</p>}
      <Button className="mt-6" onClick={signOut}>Sign out</Button>
    </AuthShell>
  );
}

export function SetupRequired() {
  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold text-brand-indigo">Connect Supabase</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        LEPDO CONNECT needs a Supabase project. Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to <code className="rounded bg-slate-100 px-1">.env</code>, set
        <code className="mx-1 rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>, then restart. See README.md.
      </p>
    </AuthShell>
  );
}
