import { optionalPaymentAmount } from '../../../lib/workflow-editor';
import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, Eye, EyeOff, FileText, Pencil, Plus, Trash, Upload } from 'lucide-react';
import { Badge, Button, Card, Drawer, Field, Input, Select, Textarea, Toggle, cx } from '../../../components/ui';
import { useToast } from '../../../components/Toast';
import { openDocument, orderKeys, uploadDocument } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { errorMessage, fileSize, fmtDate, money, today } from '../../../lib/format';
import { DOC_TYPES, PAYMENT_METHODS, PAYMENT_STATUS, PAYMENT_TYPES } from '../../../lib/workflows';
import type { Doc, OrderListRow, Payment, PaymentStatus } from '../../../lib/types';

function useInvalidate(orderId: string) {
  const qc = useQueryClient();
  return () => orderKeys(orderId).forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

/* ======================================================== Payments card */

export function PaymentsDocsSection({ order, payments, documents, onEditAmounts }: { order: OrderListRow; payments: Payment[]; documents: Doc[]; onEditAmounts: () => void }) {
  const [payDrawer, setPayDrawer] = useState<{ open: boolean; payment?: Payment }>({ open: false });
  const [uploadOpen, setUploadOpen] = useState(false);
  const toast = useToast();
  const invalidate = useInvalidate(order.id);
  const { isAdmin, profile } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markReceived(p: Payment) {
    setBusyId(p.id);
    const { error } = await supabase.from('payments').update({ status: 'confirmed' }).eq('id', p.id);
    setBusyId(null);
    if (error) return toast.error(errorMessage(error));
    invalidate();
    toast.success(`${money(p.amount, p.currency)} confirmed received`);
  }

  async function toggleVisibility(d: Doc) {
    setBusyId(d.id);
    const { error } = await supabase.from('documents').update({ customer_visible: !d.customer_visible }).eq('id', d.id);
    setBusyId(null);
    if (error) return toast.error(errorMessage(error));
    invalidate();
    toast.success(!d.customer_visible ? 'Now visible to the customer' : 'Now internal only');
  }

  async function removeDoc(d: Doc) {
    if (!window.confirm(`Delete “${d.name}”? This cannot be undone.`)) return;
    setBusyId(d.id);
    const { error } = await supabase.from('documents').delete().eq('id', d.id);
    if (!error) await supabase.storage.from('order-documents').remove([d.storage_path]);
    setBusyId(null);
    if (error) return toast.error(errorMessage(error));
    invalidate();
    toast.success('Document deleted');
  }

  async function download(d: Doc) {
    try {
      await openDocument(d.storage_path, d.name);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const balance = order.balance_due;
  return (
    <Card title="Payments & Documents" bodyClass="p-0">
      {/* Summary */}
      <div className="px-4 pt-4 sm:px-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Proforma amount</dt>
          <dd className="text-right tabular-nums">{money(order.proforma_amount, order.currency)}</dd>
          <dt className="text-slate-500">Final invoice amount</dt>
          <dd className="text-right tabular-nums">{order.final_invoice_amount !== null ? money(order.final_invoice_amount, order.currency) : <span className="text-slate-400">Not set</span>}</dd>
          <dt className="text-slate-500">Confirmed received</dt>
          <dd className="text-right font-medium tabular-nums text-emerald-700">{money(order.amount_received, order.currency)}</dd>
          <dt className="font-medium text-slate-800">Remaining balance</dt>
          <dd className={cx('text-right font-semibold tabular-nums', balance !== null && balance > 0 ? 'text-orange-700' : 'text-slate-800')}>
            {balance === null ? '—' : balance < 0 ? `${money(-balance, order.currency)} overpaid` : money(balance, order.currency)}
          </dd>
        </dl>
        <button className="mt-2 text-xs font-medium text-brand-indigo hover:underline" onClick={onEditAmounts}>Edit amounts</button>
      </div>

      {/* Payment list */}
      <div className="mt-4 border-t border-slate-100 px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Payments</h3>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPayDrawer({ open: true })}>Record Payment</Button>
        </div>
        {payments.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className={cx('font-medium tabular-nums', p.status === 'failed' && 'text-slate-400 line-through')}>{money(p.amount, p.currency)}</span>
                    <span className="text-slate-500"> · {PAYMENT_TYPES[p.payment_type]}</span>
                  </p>
                  <p className="text-xs text-slate-500">{fmtDate(p.payment_date)} · {PAYMENT_METHODS[p.method] || p.method}{p.reference ? ` · Ref ${p.reference}` : ''}</p>
                  {p.notes && <p className="text-xs italic text-slate-500">{p.notes}</p>}
                </div>
                <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                {p.status === 'initiated' && isAdmin && (
                  <Button size="sm" variant="indigo" icon={<Check className="h-3.5 w-3.5" />} loading={busyId === p.id} onClick={() => markReceived(p)}>Mark received</Button>
                )}
                <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-indigo" onClick={() => setPayDrawer({ open: true, payment: p })} aria-label="Edit payment"><Pencil className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documents */}
      <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Documents</h3>
          <Button size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => setUploadOpen(true)}>Upload Document</Button>
        </div>
        {documents.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">No documents uploaded.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <button onClick={() => download(d)} className="block max-w-full truncate text-left text-sm font-medium text-slate-800 hover:text-brand-indigo">{d.name}</button>
                  <p className="truncate text-xs text-slate-500">{DOC_TYPES[d.doc_type]?.label || d.doc_type} · {fmtDate(d.created_at)} · {d.author?.full_name || '—'}{d.size_bytes ? ` · ${fileSize(d.size_bytes)}` : ''}</p>
                </div>
                <button
                  onClick={() => toggleVisibility(d)}
                  disabled={busyId === d.id}
                  className={cx('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition', d.customer_visible ? 'bg-indigo-50 text-brand-indigo hover:bg-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                  title="Toggle customer visibility"
                >
                  {d.customer_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {d.customer_visible ? 'Customer' : 'Internal'}
                </button>
                <button onClick={() => download(d)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-indigo" aria-label="Download"><Download className="h-4 w-4" /></button>
                {(isAdmin || d.created_by === profile?.id) && (
                  <button onClick={() => removeDoc(d)} disabled={busyId === d.id} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <PaymentDrawer open={payDrawer.open} payment={payDrawer.payment} order={order} payments={payments} onClose={() => setPayDrawer({ open: false })} />
      <UploadDrawer open={uploadOpen} order={order} onClose={() => setUploadOpen(false)} />
    </Card>
  );
}

/* ========================================================= Payment form */

function PaymentDrawer({ open, onClose, order, payment, payments }: { open: boolean; onClose: () => void; order: OrderListRow; payment?: Payment; payments: Payment[] }) {
  const toast = useToast();
  const invalidate = useInvalidate(order.id);
  const { isAdmin } = useAuth();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState('bank_transfer');
  const [ptype, setPtype] = useState('advance');
  const [status, setStatus] = useState<PaymentStatus>(isAdmin ? 'confirmed' : 'initiated');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    if (payment) {
      setAmount(String(payment.amount)); setDate(payment.payment_date); setMethod(payment.method); setPtype(payment.payment_type);
      setStatus(payment.status); setReference(payment.reference || ''); setNotes(payment.notes || '');
    } else {
      const hasConfirmed = payments.some((p) => p.status === 'confirmed');
      setAmount(order.balance_due && order.balance_due > 0 ? String(order.balance_due) : '');
      setDate(today()); setMethod('bank_transfer'); setPtype(hasConfirmed ? 'final' : 'advance'); setStatus(isAdmin ? 'confirmed' : 'initiated'); setReference(''); setNotes('');
    }
  }, [open, payment, payments, order.balance_due]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    let amt: number;
    try { amt = optionalPaymentAmount(amount); } catch (e) { return setError(errorMessage(e)); }
    setBusy(true);
    setError(null);
    try {
      let documentId = payment?.document_id ?? null;
      if (file) {
        const doc = await uploadDocument(order.id, file, { doc_type: 'payment_confirmation', customer_visible: false, name: file.name });
        documentId = doc.id;
      }
      const values = { amount: amt, currency: order.currency, payment_date: date || today(), method, payment_type: ptype, status: amt === 0 ? 'initiated' : status, reference: reference.trim() || null, notes: notes.trim() || null, document_id: documentId };
      const res = payment
        ? await supabase.from('payments').update(values).eq('id', payment.id)
        : await supabase.from('payments').insert({ ...values, order_id: order.id });
      if (res.error) throw res.error;
      invalidate();
      toast.success(amt > 0 && status === 'confirmed' ? 'Payment recorded and balance updated' : 'Payment recorded');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!payment || !window.confirm('Delete this payment record? This cannot be undone.')) return;
    setBusy(true);
    const { error } = await supabase.from('payments').delete().eq('id', payment.id);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    invalidate();
    toast.success('Payment deleted');
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={payment ? 'Edit payment' : 'Record payment'}
      subtitle={`${order.reference} · balance ${money(order.balance_due, order.currency)}`}
      footer={<>
        {payment && isAdmin && <Button variant="danger" className="mr-auto" onClick={remove} disabled={busy}>Delete</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="payment-form" loading={busy}>Save payment</Button>
      </>}
    >
      <form id="payment-form" onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <Field label="Amount"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="0.00" /></Field>
          <Field label="Currency" hint="Order currency"><Input value={order.currency} disabled /></Field>
        </div>
        <Field label="Payment status" group>
          <div className="grid grid-cols-3 gap-2">
            {(['initiated', 'confirmed', 'failed'] as PaymentStatus[]).map((s) => (
              <button key={s} type="button" disabled={!isAdmin && s === 'confirmed'} onClick={() => setStatus(s)}
                className={cx('rounded-lg border px-2 py-2 text-[13px] transition', status === s ? 'border-brand-indigo bg-cream-100 font-medium text-brand-indigo ring-1 ring-brand-indigo' : 'border-slate-200 text-slate-700')}>
                {PAYMENT_STATUS[s].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Only <strong>Received / Confirmed</strong> payments reduce the balance. Use <em>Initiated</em> when the customer says they have sent it.</p>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Payment date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Payment type"><Select value={ptype} onChange={(e) => setPtype(e.target.value)}>{Object.entries(PAYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <Field label="Payment method"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Reference number"><Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="SWIFT / UTR / transaction ID" /></Field>
        <Field label="Notes" hint="Internal only."><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></Field>
        <Field label="Supporting document" hint={payment?.document_id ? 'A document is already attached; choosing a file adds a new one.' : 'Saved as an internal document.'}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-indigo" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Drawer>
  );
}

/* ========================================================== Upload form */

function UploadDrawer({ open, onClose, order }: { open: boolean; onClose: () => void; order: OrderListRow }) {
  const toast = useToast();
  const invalidate = useInvalidate(order.id);
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState('proforma_invoice');
  const [visible, setVisible] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFiles([]); setName(''); setError(null);
    const guess = order.current_stage_key === 'final_invoice' ? 'final_invoice' : order.current_stage_key === 'proforma' ? 'proforma_invoice' : order.current_stage_key === 'cad_approval' ? 'cad_design' : order.current_stage_key === 'quality_check' ? (order.order_type === 'diamond' ? 'diamond_certificate' : 'qc_image') : order.current_stage_key === 'shipped' || order.current_stage_key === 'ready_to_ship' ? 'commercial_invoice' : 'proforma_invoice';
    setDocType(guess);
    setVisible(DOC_TYPES[guess].visible);
  }, [open, order.current_stage_key, order.order_type]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!files.length) { onClose(); return; }
    setBusy(true);
    setError(null);
    let ok = 0;
    for (const f of files) {
      try {
        await uploadDocument(order.id, f, { doc_type: docType, customer_visible: visible, name: files.length === 1 && name.trim() ? name.trim() : f.name });
        ok++;
      } catch (err) {
        setError(`${f.name}: ${errorMessage(err)}`);
      }
    }
    setBusy(false);
    invalidate();
    if (ok) toast.success(`${ok} document${ok > 1 ? 's' : ''} uploaded`);
    if (ok === files.length) onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Upload document"
      subtitle={order.reference}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="upload-form" loading={busy}>Upload</Button>
      </>}
    >
      <form id="upload-form" onSubmit={save} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center transition hover:border-brand-indigo/40 hover:bg-cream-50">
          <Upload className="h-6 w-6 text-brand-indigo" />
          <span className="mt-2 text-sm font-medium text-brand-indigo">{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Choose files'}</span>
          <span className="mt-0.5 text-xs text-slate-500">{files.length ? files.map((f) => f.name).join(', ') : 'PDF, images, Office files · up to 25 MB each'}</span>
          <input type="file" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        <Field label="Document type">
          <Select value={docType} onChange={(e) => { setDocType(e.target.value); setVisible(DOC_TYPES[e.target.value].visible); }}>
            {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        {files.length === 1 && (
          <Field label="Document name" hint="Defaults to the file name."><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={files[0]?.name} maxLength={200} /></Field>
        )}
        <Toggle checked={visible} onChange={setVisible} label="Visible to customer" hint={visible ? 'The customer can view and download it in the portal.' : 'Private — LEPDO team only.'} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Drawer>
  );
}
