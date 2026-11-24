import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Pencil, Trash2, UserX } from 'lucide-react';
import { Badge, Button, Card, Drawer, Field, Input, Select, Toggle, EmptyState, PageLoader } from './ui';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth';
import { errorMessage, fmtDate } from '../lib/format';
import type { SellerStatus } from '../lib/seller-access';
import { manageSeller, sellerDirectory, deleteSellerPermanently } from '../lib/seller.functions';
import type { SellerEdit } from '../lib/seller-management';

interface RequestRow {
  user_id: string;
  status: SellerStatus;
  created_at: string;
  full_name: string; email: string; phone: string | null;
  is_active: boolean;
}

export default function SellerRequests() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<SellerEdit | null>(null);
  const saveSeller = useServerFn(manageSeller);
  const loadSellers = useServerFn(sellerDirectory);
  const removeSeller = useServerFn(deleteSellerPermanently);
  const requests = useQuery({
    queryKey: ['seller-requests'], enabled: isAdmin,
    queryFn: async () => {
      return await loadSellers() as RequestRow[];
    },
  });
  if (!isAdmin) return null;
  async function persist(edit: SellerEdit) {
    if (busy) return;
    setBusy(edit.user_id);
    try {
      await saveSeller({ data: edit });
      await qc.invalidateQueries();
      setEditing(null);
      toast.success(edit.status === 'approved' && edit.is_active ? 'Seller saved. Password login is active.' : 'Seller saved');
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }
  function draft(row: RequestRow): SellerEdit {
    return { user_id: row.user_id, full_name: row.full_name, phone: row.phone ?? '', status: row.status, is_active: row.is_active };
  }
  async function permanentlyDelete(row: RequestRow) {
    if (busy) return;
    setBusy(row.user_id);
    try {
      await removeSeller({ data: { user_id: row.user_id, confirmation: 'DELETE PERMANENTLY' } });
      await qc.invalidateQueries();
      toast.success('Seller account permanently deleted. Work and historical name preserved.');
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }
  return <><Card title="Seller Requests" bodyClass="p-0">
    {requests.isLoading ? <PageLoader /> : requests.error ? <p role="alert" className="p-4 text-destructive">{errorMessage(requests.error)}</p> : !requests.data?.length ? <EmptyState title="No seller requests yet." /> :
      <div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Seller Name</th><th>Email</th><th>Phone</th><th>Request Date</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
        <tbody>{requests.data.map(r => <tr key={r.user_id}>
          <td>{r.full_name}</td><td>{r.email}</td><td>{r.phone || '—'}</td><td>{fmtDate(r.created_at)}</td>
          <td><Badge tone={r.status === 'approved' && r.is_active ? 'green' : r.status === 'pending' ? 'orange' : 'red'}>{r.status === 'pending' ? 'Pending Approval' : r.status === 'approved' ? r.is_active ? 'Approved' : 'Deactivated' : 'Rejected'}</Badge></td>
          <td><div className="flex justify-end gap-2">{(r.status !== 'approved' || !r.is_active) && <>
            <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => { if (window.confirm('Approve this seller request?')) void persist({ ...draft(r), status: 'approved', is_active: true }); }}>Approve</Button>
          </>}
          {r.status !== 'rejected' && <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => { if (window.confirm('Reject this seller request?')) void persist({ ...draft(r), status: 'rejected', is_active: false }); }}>Reject</Button>}
          <Button size="sm" title="Edit seller" aria-label={`Edit ${r.full_name}`} icon={<Pencil className="h-4 w-4" />} disabled={busy !== null} onClick={() => setEditing(draft(r))} />
          {r.is_active && <Button size="sm" title="Deactivate seller" aria-label={`Deactivate ${r.full_name}`} icon={<UserX className="h-4 w-4" />} disabled={busy !== null} onClick={() => { if (window.confirm('Deactivate this seller? Login access will be revoked and all work preserved.')) void persist({ ...draft(r), is_active: false }); }} />}
          <Button size="sm" variant="danger" title="Delete Permanently" aria-label={`Delete Permanently ${r.full_name}`} icon={<Trash2 className="h-4 w-4" />} disabled={busy !== null} onClick={() => { if (window.confirm(`Permanently delete ${r.full_name}’s seller account? This cannot be undone. Their login and profile will be removed; all orders, customers, transactions and activities will remain with their name for reference.`)) void permanentlyDelete(r); }} />
          </div></td>
        </tr>)}</tbody>
      </table></div>}
  </Card>
  <Drawer open={editing !== null} title="Edit seller" onClose={() => { if (!busy) setEditing(null); }}>
    {editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void persist(editing); }}>
      <Field label="Full name"><Input required maxLength={120} value={editing.full_name} onChange={e => setEditing({ ...editing, full_name: e.target.value })} /></Field>
      <Field label="Phone (optional)"><Input type="tel" maxLength={50} value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></Field>
      <Field label="Approval status"><Select value={editing.status} onChange={e => { const status = e.target.value as SellerStatus; setEditing({ ...editing, status, is_active: status === 'approved' }); }}><option value="pending">Pending Approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Select></Field>
      {editing.status === 'approved' && <Toggle label="Account active" checked={editing.is_active} onChange={is_active => setEditing({ ...editing, is_active })} />}
      <Button type="submit" variant="primary" loading={busy !== null}>Save seller</Button>
    </form>}
  </Drawer></>;
}