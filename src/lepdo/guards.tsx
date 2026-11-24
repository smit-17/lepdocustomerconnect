import type { ReactNode } from 'react';
import { Navigate } from './router';
import { useAuth } from './lib/auth';
import { PageLoader } from './components/ui';
import { AccessIssue } from './pages/auth/Status';
import { accountAccess } from './lib/seller-access';

export function RequireRole({ staff, children }: { staff: boolean; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role === 'seller' && profile.seller_status !== 'approved') return <AccessIssue reason={profile.seller_status === 'rejected' ? 'seller-rejected' : 'seller-pending'} />;
  if (!profile || !profile.is_active) return <AccessIssue reason="inactive" />;
  const { isStaff } = accountAccess(profile.role, profile.is_active, profile.seller_status);
  if (staff && !isStaff) return <Navigate to="/portal" replace />;
  if (!staff && isStaff) return <Navigate to="/admin" replace />;
  if (!staff && !profile.customer_id) return <AccessIssue reason="no-customer" />;
  return <>{children}</>;
}

export function Home() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role === 'seller' && profile.seller_status !== 'approved') return <AccessIssue reason={profile.seller_status === 'rejected' ? 'seller-rejected' : 'seller-pending'} />;
  if (!profile?.is_active) return <AccessIssue reason="inactive" />;
  return <Navigate to={profile.role === 'customer' ? '/portal' : '/admin'} replace />;
}
