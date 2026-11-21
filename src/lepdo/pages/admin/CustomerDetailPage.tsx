import { useState } from 'react';
import { Link, useParams } from '@/lepdo/router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, MapPin, Package, Pencil, Phone, Plus, Send, UserRound } from 'lucide-react';
import { Button, Card, EmptyState, ErrorNote, PageHeader, PageLoader } from '../../components/ui';
import { PortalStatusBadge, StageCell, TypeLabel } from '../../components/OrderBits';
import { useToast } from '../../components/Toast';
import { sendInvite, useCustomer, useOrders } from '../../lib/api';
import { errorMessage, fmtDate, money, timeAgo } from '../../lib/format';
import type { OrderListRow } from '../../lib/types';
import { useQuickActions } from '../../layouts/AdminLayout';
import CustomerDrawer from './CustomerDrawer';
import { KycReview } from '../../components/KycReview';

function OrderRows({ orders, empty }: { orders: OrderListRow[]; empty: string }) {
  if (!orders.length) return <p className="px-5 py-6 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {orders.map((o) => (
        <li key={o.id}>
          <Link to={`/admin/orders/${o.id}`} className="grid grid-cols-1 gap-1 px-4 py-3 transition hover:bg-cream-50 sm:grid-cols-[140px_1fr_auto_auto] sm:items-center sm:gap-4 sm:px-5">
            <span className="font-medium text-brand-indigo">{o.reference}</span>
            <span className="min-w-0 truncate text-sm text-slate-700"><TypeLabel type={o.order_type} /> · {o.title}</span>
            <span className="text-sm"><StageCell name={o.current_stage_name} status={o.current_stage_status} orderStatus={o.status} /></span>
            <span className="text-sm tabular-nums text-slate-600 sm:w-28 sm:text-right">{money(o.total_amount, o.currency)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { data: c, isLoading, error } = useCustomer(id);
  const orders = useOrders({ customerId: id });
  const quick = useQuickActions();
  const toast = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [inviting, setInviting] = useState(false);

  if (isLoading) return <PageLoader />;
  if (error || !c) return <ErrorNote error={error || 'Customer not found'} />;

  const active = (orders.data || []).filter((o) => o.status === 'active');
  const done = (orders.data || []).filter((o) => o.status === 'completed');
  const cancelled = (orders.data || []).filter((o) => o.status === 'cancelled');

  async function invite() {
    setInviting(true);
    try {
      const r = await sendInvite({ kind: 'customer', customer_id: id });
      toast.success(r.status === 'resent' ? `Sign-in link re-sent to ${r.email}` : `Invitation sent to ${r.email}`);
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  return (
    <>
      <Link to="/admin/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-indigo"><ArrowLeft className="h-4 w-4" /> Customers</Link>
      <PageHeader
        title={c.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{c.country} · <PortalStatusBadge status={c.portal_status} /></span>}
        actions={<>
          <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Edit</Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => quick.newOrder(c.id)}>Create Order</Button>
        </>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            {c.contact_person && <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-slate-400" /><dd>{c.contact_person}</dd></div>}
            <div className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 text-slate-400" /><dd><a className="text-brand-indigo hover:underline" href={`mailto:${c.email}`}>{c.email}</a></dd></div>
            {c.phone && <div className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 text-slate-400" /><dd>{c.phone}</dd></div>}
            {c.address && <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 text-slate-400" /><dd className="whitespace-pre-line">{c.address}</dd></div>}
            <div className="border-t border-slate-100 pt-3">
              <dt className="text-xs text-slate-500">Assigned executive</dt>
              <dd className="font-medium text-slate-800">{c.executive_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Customer portal</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <PortalStatusBadge status={c.portal_status} />
                {c.portal_invited_at && <span className="text-xs text-slate-500">invited {fmtDate(c.portal_invited_at)}</span>}
              </dd>
              {c.portal_status !== 'disabled' && (
                <Button size="sm" className="mt-2" icon={<Send className="h-3.5 w-3.5" />} loading={inviting} onClick={invite}>
                  {c.portal_status === 'not_invited' ? 'Send Customer Invitation' : 'Re-send sign-in link'}
                </Button>
              )}
            </div>
            {c.internal_notes && (
              <div className="rounded-lg bg-amber-50/60 p-3">
                <dt className="text-xs font-medium text-amber-800">Internal notes</dt>
                <dd className="mt-1 whitespace-pre-line text-slate-700">{c.internal_notes}</dd>
              </div>
            )}
            <p className="text-xs text-slate-400">Last activity {timeAgo(c.last_activity)}</p>
          </dl>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <KycReview customerId={id} />
          <Card title={`Active Orders (${active.length})`} bodyClass="p-0" action={<Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => quick.newOrder(c.id)}>New</Button>}>
            {orders.isLoading ? <div className="py-6" /> : active.length || done.length ? <OrderRows orders={active} empty="No active orders." /> : (
              <EmptyState icon={<Package className="h-5 w-5" />} title="No active orders yet." text="Create your first order for this customer." action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => quick.newOrder(c.id)}>Create Order</Button>} />
            )}
          </Card>
          <Card title={`Completed Orders (${done.length})`} bodyClass="p-0">
            <OrderRows orders={done} empty="No completed orders yet." />
          </Card>
          {cancelled.length > 0 && (
            <Card title={`Cancelled (${cancelled.length})`} bodyClass="p-0">
              <OrderRows orders={cancelled} empty="" />
            </Card>
          )}
        </div>
      </div>

      <CustomerDrawer open={edit} onClose={() => setEdit(false)} customer={c} />
    </>
  );
}
