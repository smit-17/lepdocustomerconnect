import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from '@/lepdo/router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ellipsis, Pencil, RefreshCw, Star } from 'lucide-react';
import { Button, Card, Drawer, ErrorNote, Field, Input, PageLoader, Select, Stat, Textarea, cx } from '../../components/ui';
import { OrderStatusBadge, PaymentBadge, TypeLabel } from '../../components/OrderBits';
import { useToast } from '../../components/Toast';
import { orderKeys, useDocuments, useOrder, usePayments, useShipments, useStaff, useStages, useUpdates } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { errorMessage, fmtDate, money, timeAgo } from '../../lib/format';
import { CURRENCIES } from '../../lib/workflows';
import type { OrderListRow, OrderStatus } from '../../lib/types';
import { ProgressSection, UpdateProgressDrawer } from './order/ProgressSection';
import { PaymentsDocsSection } from './order/PaymentsDocsSection';
import { ShippingSection } from './order/ShippingSection';
import DeleteOrderButton from '../../components/DeleteOrderButton';

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useOrder(id);
  const stages = useStages(id);
  const updates = useUpdates(id);
  const payments = usePayments(id);
  const documents = useDocuments(id);
  const shipments = useShipments(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [progress, setProgress] = useState<{ open: boolean; stageId?: string }>({ open: false });
  const [editOpen, setEditOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  if (order.isLoading) return <PageLoader />;
  if (order.error || !order.data) return <ErrorNote error={order.error || 'Order not found'} />;
  const o = order.data;

  async function setStatus(status: OrderStatus) {
    setMenu(false);
    if (status === 'cancelled' && !window.confirm(`Cancel order ${o.reference}? The customer will no longer see it.`)) return;
    const { error } = await supabase.from('orders').update({ status }).eq('id', o.id);
    if (error) return toast.error(errorMessage(error));
    orderKeys(o.id).forEach((k) => qc.invalidateQueries({ queryKey: k }));
    toast.success(status === 'active' ? 'Order reopened' : status === 'completed' ? 'Order marked completed' : 'Order cancelled');
  }

  const total = o.final_invoice_amount ?? o.proforma_amount;

  return (
    <>
      <Link to="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-indigo"><ArrowLeft className="h-4 w-4" /> Orders</Link>

      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-indigo">{o.reference}</h1>
            <OrderStatusBadge status={o.status} />
            <PaymentBadge status={o.payment_status} />
          </div>
          <p className="mt-1 text-[15px] text-slate-700">{o.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <Link to={`/admin/customers/${o.customer_id}`} className="font-medium text-brand-indigo hover:underline">{o.customer_name}</Link>
            <TypeLabel type={o.order_type} />
            <span>Current: <span className="font-medium text-slate-800">{o.status === 'cancelled' ? 'Cancelled' : o.current_stage_name}</span></span>
            <span>Executive: <span className="text-slate-800">{o.executive_name || '—'}</span></span>
            {o.customer_po_ref && <span>PO: <span className="text-slate-800">{o.customer_po_ref}</span></span>}
            <span>Updated {timeAgo(o.updated_at)}</span>
          </div>
        </div>
        <div className="relative flex shrink-0 flex-wrap items-center gap-2">
          <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="primary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setProgress({ open: true })} disabled={o.status === 'cancelled'}>Update Progress</Button>
          <button onClick={() => setMenu((v) => !v)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="More actions"><Ellipsis className="h-4 w-4" /></button>
          <DeleteOrderButton orderId={o.id} reference={o.reference} onDeleted={() => navigate('/admin/orders')} />
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-pop">
                {o.status === 'active' && <button className="block w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => setStatus('completed')}>Mark order completed</button>}
                {o.status !== 'active' && <button className="block w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => setStatus('active')}>Reopen order</button>}
                {o.status !== 'cancelled' && <button className="block w-full px-4 py-2 text-left text-red-700 hover:bg-red-50" onClick={() => setStatus('cancelled')}>Cancel order</button>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Money / delivery cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Order Amount" value={money(total, o.currency)} hint={o.final_invoice_amount !== null ? 'Final invoice' : o.proforma_amount !== null ? 'Proforma' : 'Not set yet'} />
        <Stat label="Payment Received" value={money(o.amount_received, o.currency)} tone="green" hint="Confirmed only" />
        <Stat label="Balance Pending" value={o.balance_due === null ? '—' : money(Math.max(o.balance_due, 0), o.currency)} tone={o.balance_due && o.balance_due > 0 ? 'orange' : 'default'} hint={o.balance_due !== null && o.balance_due < 0 ? `${money(-o.balance_due, o.currency)} overpaid` : undefined} />
        <Stat label="Estimated Delivery" value={o.expected_delivery_date ? fmtDate(o.expected_delivery_date) : '—'} hint={o.status === 'completed' && o.completed_at ? `Completed ${fmtDate(o.completed_at)}` : undefined} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {stages.data && <ProgressSection order={o} stages={stages.data} updates={updates.data || []} onUpdate={(stageId) => setProgress({ open: true, stageId })} />}
          {o.notes && (
            <Card title="Internal notes"><p className="whitespace-pre-line text-sm text-slate-700">{o.notes}</p></Card>
          )}
          {o.feedback_rating && (
            <Card title="Customer feedback">
              <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cx('h-4 w-4', n <= (o.feedback_rating || 0) ? 'fill-brand-amber text-brand-amber' : 'text-slate-300')} />)}</div>
              {o.feedback_comment && <p className="mt-2 text-sm text-slate-700">“{o.feedback_comment}”</p>}
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <PaymentsDocsSection order={o} payments={payments.data || []} documents={documents.data || []} onEditAmounts={() => setEditOpen(true)} />
          <ShippingSection order={o} shipments={shipments.data || []} />
        </div>
      </div>

      {stages.data && <UpdateProgressDrawer open={progress.open} initialStageId={progress.stageId} onClose={() => setProgress({ open: false })} order={o} stages={stages.data} />}
      <EditOrderDrawer open={editOpen} onClose={() => setEditOpen(false)} order={o} hasPayments={(payments.data || []).length > 0} />
    </>
  );
}

function EditOrderDrawer({ open, onClose, order, hasPayments }: { open: boolean; onClose: () => void; order: OrderListRow; hasPayments: boolean }) {
  const staff = useStaff();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ title: '', po: '', currency: 'USD', proforma: '', final: '', eta: '', exec: '', notes: '', terms: '', action: '', department: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF({
      title: order.title, po: order.customer_po_ref || '', currency: order.currency,
      proforma: order.proforma_amount?.toString() ?? '', final: order.final_invoice_amount?.toString() ?? '',
      eta: order.expected_delivery_date || '', exec: order.executive_override_id || '', notes: order.notes || '',
      terms: order.payment_terms || '', action: order.customer_action_required || '', department: order.current_responsible_dept || '',
    });
  }, [open, order]);

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const proforma = num(f.proforma);
    const final = num(f.final);
    if ((proforma !== null && (Number.isNaN(proforma) || proforma < 0)) || (final !== null && (Number.isNaN(final) || final < 0))) return setError('Amounts must be positive numbers.');
    if (!f.title.trim()) return setError('Title is required.');
    setBusy(true);
    const { error } = await supabase.from('orders').update({
      title: f.title.trim(), customer_po_ref: f.po.trim() || null, currency: f.currency, proforma_amount: proforma,
      final_invoice_amount: final, expected_delivery_date: f.eta || null, executive_override_id: f.exec || null, notes: f.notes.trim() || null,
      payment_terms: f.terms.trim() || null, customer_action_required: f.action.trim() || null, current_responsible_dept: f.department || null,
    }).eq('id', order.id);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    orderKeys(order.id).forEach((k) => qc.invalidateQueries({ queryKey: k }));
    toast.success('Order updated');
    onClose();
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <Drawer open={open} onClose={onClose} title="Edit order" subtitle={order.reference}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="edit-order-form" loading={busy}>Save changes</Button></>}>
      <form id="edit-order-form" onSubmit={save} className="space-y-4">
        <Field label="Order title or reference" required><Input value={f.title} onChange={set('title')} maxLength={200} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_100px]">
          <Field label="Proforma amount"><Input inputMode="decimal" value={f.proforma} onChange={set('proforma')} placeholder="0.00" /></Field>
          <Field label="Final invoice amount" hint="Balance uses this when set."><Input inputMode="decimal" value={f.final} onChange={set('final')} placeholder="0.00" /></Field>
          <Field label="Currency">
            <Select value={f.currency} onChange={set('currency')} disabled={hasPayments} title={hasPayments ? 'Locked after payments are recorded' : undefined}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer PO reference"><Input value={f.po} onChange={set('po')} maxLength={100} /></Field>
          <Field label="Expected delivery"><Input type="date" value={f.eta} onChange={set('eta')} /></Field>
        </div>
        <Field label="Executive for this order" hint="Leave as default to use the customer’s assigned executive.">
          <Select value={f.exec} onChange={set('exec')}>
            <option value="">Customer default</option>
            {(staff.data || []).filter((s) => s.is_active || s.id === f.exec).map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
          </Select>
        </Field>
        <Field label="Payment terms"><Input value={f.terms} onChange={set('terms')} maxLength={500} /></Field>
        <Field label="Customer action required"><Input value={f.action} onChange={set('action')} maxLength={500} /></Field>
        <Field label="Responsible department"><Select value={f.department} onChange={set('department')}><option value="">Automatic</option>{['Accounts','Design','Operations','Manufacturing','Quality Control','Shipping'].map(d => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Internal notes" hint="Never shown to the customer."><Textarea rows={3} value={f.notes} onChange={set('notes')} maxLength={4000} /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Drawer>
  );
}
