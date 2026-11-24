import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, PageLoader } from './ui';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { errorMessage, fmtDate } from '../lib/format';
import type { SellerStatus } from '../lib/seller-access';

interface RequestRow {
  user_id: string;
  status: SellerStatus;
  created_at: string;
  profiles: { full_name: string; email: string; phone: string | null };
}

export default function SellerRequests() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: ['seller-requests'], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('seller_requests').select('user_id,status,created_at,profiles!seller_requests_user_id_fkey(full_name,email,phone)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RequestRow[];
    },
  });
  if (!isAdmin) return null;
  async function decide(id: string, status: 'approved' | 'rejected') {
    if (busy) return;
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this seller request?`)) return;
    setBusy(id);
    try {
      const { error } = await supabase.rpc('admin_review_seller', { p_user_id: id, p_status: status });
      if (error) throw error;
      await qc.invalidateQueries();
      toast.success(status === 'approved' ? 'Seller approved' : 'Seller rejected');
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }
  return <Card title="Seller Requests" bodyClass="p-0">
    {requests.isLoading ? <PageLoader /> : requests.error ? <p role="alert" className="p-4 text-destructive">{errorMessage(requests.error)}</p> : !requests.data?.length ? <EmptyState title="No seller requests yet." /> :
      <div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Seller Name</th><th>Email</th><th>Phone</th><th>Request Date</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
        <tbody>{requests.data.map(r => <tr key={r.user_id}>
          <td>{r.profiles.full_name}</td><td>{r.profiles.email}</td><td>{r.profiles.phone || '—'}</td><td>{fmtDate(r.created_at)}</td>
          <td><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'orange'}>{r.status === 'pending' ? 'Pending Approval' : r.status === 'approved' ? 'Approved' : 'Rejected'}</Badge></td>
          <td className="whitespace-nowrap text-right">{r.status === 'pending' && <>
            <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => decide(r.user_id, 'approved')}>Approve</Button>
            <Button size="sm" variant="danger" className="ml-2" disabled={busy !== null} onClick={() => decide(r.user_id, 'rejected')}>Reject</Button>
          </>}</td>
        </tr>)}</tbody>
      </table></div>}
  </Card>;
}