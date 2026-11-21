import type { ReactNode } from 'react';
import { Navigate } from './router';
import { useAuth } from './lib/auth';
import { PageLoader } from './components/ui';
import { AccessIssue } from './pages/auth/Status';

export function RequireRole({ staff, children }: { staff: boolean; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !profile.is_active) return <AccessIssue reason="inactive" />;
  const isStaff = profile.role === 'admin' || profile.role === 'team';
  if (staff && !isStaff) return <Navigate to="/portal" replace />;
  if (!staff && isStaff) return <Navigate to="/admin" replace />;
  if (!staff && !profile.customer_id) return <AccessIssue reason="no-customer" />;
  return <>{children}</>;
}

export function Home() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.is_active) return <AccessIssue reason="inactive" />;
  return <Navigate to={profile.role === 'customer' ? '/portal' : '/admin'} replace />;
}
