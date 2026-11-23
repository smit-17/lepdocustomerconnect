import { optionalPaymentAmount, schemaForStage } from '../../lib/workflow-editor';
import { useCallback, useState, type ReactNode } from 'react';
import { Link, useParams } from '@/lepdo/router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, Download, ExternalLink, FileText, Gem, PackageCheck, Sparkles, Star, Truck } from 'lucide-react';
import { Button, ErrorNote, Field, Input, PageLoader, ProgressBar, Textarea, cx } from '../../components/ui';
import { StatusIcon } from '../../components/StatusIcon';
import { ExecutiveCard } from '../../components/ExecutiveCard';
import { useToast } from '../../components/Toast';
import { keys, openDocument, usePortalOrder } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { errorMessage, fileSize, fmtDate, money, timeAgo } from '../../lib/format';
import { DOC_TYPES, INVOICE_DOC_TYPES, PAYMENT_STATUS, PAYMENT_TYPES, SHIPMENT_STATUS, STAGE_STATUS, journeyProgress, docTypeForStage } from '../../lib/workflows';
import { DocumentViewerModal, type ViewerFile } from '../../components/DocumentViewerModal';
import { ApprovalBlock } from './ApprovalBlock';
import { uploadCustomerFile, PROOF_MAX_BYTES } from '../../lib/portal-management';
import type { PortalOrder } from '../../lib/types';

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-cream-200 bg-white p-5 sm:p-6', className)}>
      <h2 className="mb-4 text-[15px] font-semibold text-brand-indigo">{title}</h2>
      {children}
    </section>
  );
}

export default function PortalOrderPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = usePortalOrder(id);
  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="py-10 text-center">
        <ErrorNote error={error || 'Order not found'} />
        <Link to="/portal" className="mt-4 inline-block text-sm font-medium text-brand-indigo">← Back to my orders</Link>
      </div>
    );
  }
  return <OrderView d={data} />;
}

export function OrderView({ d, readOnly = false, onBack, sharePath }: { d: PortalOrder; readOnly?: boolean; onBack?: () => void; sharePath?: string }) {
  const toast = useToast();
  const o = d.order;
  const done = o.status === 'completed';
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ViewerFile | null>(null);
  const approvals = d.extra.approvals || [];
  const pendingApproval = approvals.find(a => a.status === 'pending' && a.customer_approval_required);
  const qc = useQueryClient();
  const stages = d.stages.filter(s => s.status !== 'not_applicable' && d.extra.stage_positions[s.id] > 0).sort((a, b) => d.extra.stage_positions[a.id] - d.extra.stage_positions[b.id]);
  const progress = journeyProgress(stages, o.status);
  const pendingPayment = d.payment.payments.some(p => p.status === 'initiated');
  const latestCad = d.documents.find(doc => doc.doc_type === 'cad_design');
  const cadApproved = !!latestCad && d.extra.cad_approvals.some(a => a.document_id === latestCad.id);
  const nextAction = done ? 'Order delivered' : pendingApproval ? 'Review and approve the latest file' : pendingPayment ? 'Verify payment receipt' : latestCad && !cadApproved ? 'Review and approve CAD design' : o.current_stage_name || 'Order confirmation';
  const department = d.extra.current_responsible_dept || (pendingPayment ? 'Accounts' : latestCad && !cadApproved ? 'Design' : ['shipped','tracking','ready_to_ship'].includes(o.current_stage_key || '') ? 'Shipping' : 'Operations');
  async function approveCad() {
    if (!latestCad) return;
    setBusy(true);
    try { await runCad(); await qc.invalidateQueries({ queryKey: keys.portalOrder(o.id) }); toast.success('CAD approved'); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }
  async function runCad() {
    const { error } = await supabase.rpc('portal_approve_cad', { p_order_id: o.id, p_document_id: latestCad?.id });
    if (error) throw error;
  }
  const closeViewer = useCallback(() => setViewing(null), []);
  const latest = d.updates[0];
  const activeShipment = d.shipments.find((s) => s.tracking_url && s.status !== 'delivered') || d.shipments.find((s) => s.tracking_url);
  const total = d.payment.final_invoice_amount ?? d.payment.proforma_amount;

  async function download(path: string, name: string) {
    try {
      await openDocument(path, name);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="overflow-x-hidden">
      <Link to={sharePath || "/portal"} onClick={onBack ? e => { e.preventDefault(); onBack(); } : undefined} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-indigo"><ArrowLeft className="h-4 w-4" /> My orders</Link>

      {/* Title */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-indigo sm:text-3xl">{o.reference}</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-brand-indigo">
          {o.order_type === 'diamond' ? <Gem className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}{o.order_type === 'diamond' ? 'Diamond' : 'Jewellery'}
        </span>
      </div>
      <p className="mt-1 text-[15px] text-slate-700">{o.title}{o.customer_po_ref && <span className="text-slate-500"> · PO {o.customer_po_ref}</span>}</p>

      {!readOnly && <section className="mt-6 border-y border-cream-200 py-5">
        <h2 className="text-lg font-semibold text-brand-indigo">What Happens Next?</h2>
        <p className="mt-2 text-sm font-medium">{nextAction}</p>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Responsible department</dt><dd>{department}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Your action</dt><dd>{d.extra.customer_action_required || (done ? 'Optional feedback' : pendingApproval ? `Approve or request changes (version ${pendingApproval.version})` : pendingPayment ? 'No action — payment submitted for verification' : latestCad && !cadApproved ? 'Approve the latest CAD design' : 'No action required')}</dd></div>
        </dl>
      </section>}
      {/* Status hero — understandable in five seconds */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-cream-200 bg-white">
        <div className="p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">{done ? 'Order complete' : 'Current status'}</p>
          <div className="mt-3 flex items-center gap-3">
            <StatusIcon status={done ? 'completed' : o.current_stage_status || 'upcoming'} current={!done} size="lg" />
            <div className="min-w-0">
              <p className="text-xl font-semibold text-brand-indigo sm:text-2xl">{done ? 'Delivered' : o.current_stage_name}</p>
              {!done && o.current_stage_status && o.current_stage_status !== 'upcoming' && o.current_stage_status !== 'completed' && (
                <p className="text-sm text-slate-500">{STAGE_STATUS[o.current_stage_status].customerLabel}</p>
              )}
              {done && <p className="text-sm text-slate-500">Completed {fmtDate(o.completed_at)}</p>}
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <ProgressBar value={progress} className="h-2" />
            <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-indigo">{progress}%</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {!readOnly && <div><p className="text-xs text-slate-500">Order amount</p><p className="font-semibold tabular-nums text-slate-900">{money(total, d.payment.currency)}</p></div>}
            <div><p className="text-xs text-slate-500">Expected delivery</p><p className="font-semibold text-slate-900">{o.expected_delivery_date ? fmtDate(o.expected_delivery_date) : activeShipment?.estimated_delivery_date ? fmtDate(activeShipment.estimated_delivery_date) : 'To be confirmed'}</p></div>
            <div className="col-span-2 sm:col-span-1"><p className="text-xs text-slate-500">Last update</p><p className="font-semibold text-slate-900">{timeAgo(o.updated_at)}</p></div>
          </div>
          {latest?.note && (
            <div className="mt-5 rounded-xl bg-cream-50 px-4 py-3">
              <p className="text-xs text-slate-500">Latest update · {latest.stage_name} · {timeAgo(latest.created_at)}</p>
              <p className="mt-0.5 text-[15px] text-slate-800">{latest.note}</p>
            </div>
          )}
        </div>
        {activeShipment?.tracking_url && (
          <a href={activeShipment.tracking_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-brand-orange px-5 py-4 text-[15px] font-semibold text-brand-ink transition hover:brightness-95">
            <Truck className="h-5 w-5" /> Track Shipment
            <span className="hidden font-normal sm:inline">· {activeShipment.courier} {activeShipment.tracking_number}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </section>

      <div className={cx("mt-6 grid grid-cols-1 gap-6", !readOnly && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]")}>
        {/* Journey */}
        <Panel title="Order journey">
          <ol>
            {stages.map((s, i) => {
              const isCurrent = !done && s.stage_key === o.current_stage_key && s.status !== 'completed';
              const ticked = schemaForStage(o.order_type, s).fields.filter((x) => s.details?.[x.key]);
              const last = i === stages.length - 1;
              return (
                <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span className={cx('absolute left-[13px] top-8 h-[calc(100%-2rem)] w-0.5', s.status === 'completed' ? 'bg-emerald-500/60' : 'bg-slate-200')} />}
                  <StatusIcon status={s.status} current={isCurrent} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <Button variant="ghost" className="h-auto min-h-8 max-w-full justify-start whitespace-normal px-0 text-left" aria-expanded={!!expanded[s.id]} aria-label={`Expand ${s.name}`} onClick={() => setExpanded(v => ({ ...v, [s.id]: !v[s.id] }))}><ChevronDown className={cx("h-4 w-4 shrink-0 transition", expanded[s.id] && "rotate-180")} /><span className={cx('text-[15px] font-medium', s.status === 'upcoming' && !isCurrent ? 'text-slate-400' : 'text-slate-900')}>{s.name}</span></Button>
                      {s.completed_at && <p className="text-xs text-slate-500">{fmtDate(s.completed_at)}</p>}
                    </div>
                    {(s.status === 'attention' || s.status === 'blocked' || s.status === 'in_progress') && (
                      <p className={cx('text-xs font-medium', s.status === 'attention' ? 'text-amber-700' : s.status === 'blocked' ? 'text-red-700' : 'text-brand-indigo')}>{STAGE_STATUS[s.status].customerLabel}</p>
                    )}
                    {expanded[s.id] && <>
                    <p className="mt-2 text-xs text-muted-foreground">{s.completed_at ? `Completed ${fmtDate(s.completed_at)}` : STAGE_STATUS[s.status].customerLabel}</p>
                    {s.ui_schema?.description && <p className="mt-1 text-sm text-muted-foreground">{s.ui_schema.description}</p>}
                    {s.customer_note && <p className="mt-1 text-sm text-slate-600">{s.customer_note}</p>}
                    {ticked.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {ticked.map((t) => <li key={t.key} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800"><Check className="h-3 w-3" />{t.label}{t.type !== 'checkbox' ? `: ${s.details[t.key]}` : ''}</li>)}
                      </ul>
                    )}
                    <div className="mt-3 space-y-2">
                      {d.documents.filter(doc => d.extra.stage_documents.some(link => link.stage_id === s.id && link.document_id === doc.id) || doc.doc_type === docTypeForStage(s.stage_key)).map(doc => <Button key={doc.id} variant="ghost" className="max-w-full whitespace-normal text-left" icon={<FileText className="h-4 w-4 shrink-0" />} onClick={() => setViewing({ path: doc.storage_path, name: doc.name, mime: doc.mime_type })}>{doc.name}</Button>)}
                      {approvals.some(a => a.stage_key === s.stage_key) && <ApprovalBlock orderId={o.id} approvals={approvals.filter(a => a.stage_key === s.stage_key)} canAct={!done && !readOnly} onView={setViewing} />}
                      {s.stage_key === 'manufacturing' && (d.extra.metal_supplies || []).map((m, i) => <p key={i} className="text-xs text-slate-600">Metal supply: {m.metal_type} {m.metal_purity || ''} {m.metal_weight ? `· ${m.metal_weight} g` : ''} · {m.status}</p>)}
                      {s.stage_key === 'quality_check' && d.extra.photography && <p className="text-xs text-slate-600">Photography: {d.extra.photography.status.replace('_', ' ')}</p>}
                      {!readOnly && s.stage_key === 'cad_approval' && latestCad && !approvals.some(a => a.stage_key === 'cad_approval') && <Button variant="indigo" loading={busy} disabled={cadApproved || done} onClick={approveCad}>{cadApproved ? 'CAD approved' : 'Approve CAD design'}</Button>}
                      {!readOnly && ['payment_in_progress','advance_payment','final_payment'].includes(s.stage_key) && !done && <PaymentProof orderId={o.id} />}
                    </div>
                    </>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        {!readOnly && <div className="space-y-6">
          <Panel title="Invoices">
            <ul className="space-y-3">
              {(['proforma_invoice', 'final_invoice'] as const).map(t => {
                const docs = d.documents.filter(doc => doc.doc_type === t);
                const doc = docs[0];
                return <li key={t} className="rounded-xl border border-cream-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{t === 'proforma_invoice' ? 'Proforma Invoice' : 'Final Invoice'}{docs.length > 1 && <span className="ml-2 text-xs font-normal text-muted-foreground">Version {docs.length}</span>}</p>
                  {doc ? <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button className="min-h-11" icon={<FileText className="h-4 w-4" />} onClick={() => setViewing({ path: doc.storage_path, name: doc.name, mime: doc.mime_type })}>View</Button>
                    <Button className="min-h-11" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => download(doc.storage_path, doc.name)}>Download</Button>
                  </div> : <p className="mt-1 text-xs text-muted-foreground">{t === 'proforma_invoice' ? 'Awaiting issue.' : 'Issued before dispatch.'}</p>}
                </li>;
              })}
              {d.documents.filter(doc => INVOICE_DOC_TYPES.slice(2).includes(doc.doc_type)).map(doc => <li key={doc.id}><Button className="w-full justify-start whitespace-normal text-left" icon={<Download className="h-4 w-4 shrink-0" />} onClick={() => download(doc.storage_path, doc.name)}>{doc.name}</Button></li>)}
            </ul>
          </Panel>
          {/* Payment */}
          <Panel title="Payment summary">
            {d.extra.payment_terms && <p className="mb-3 text-sm text-muted-foreground">{d.extra.payment_terms}</p>}
            {pendingPayment && <p className="mb-3 text-sm font-medium text-brand-indigo">Payment Submitted — awaiting verification</p>}
            <dl className="space-y-2 text-sm">
              {d.payment.final_invoice_amount !== null && d.payment.proforma_amount !== null && d.payment.final_invoice_amount !== d.payment.proforma_amount && (
                <div className="flex justify-between"><dt className="text-slate-500">Proforma amount</dt><dd className="tabular-nums text-slate-500">{money(d.payment.proforma_amount, d.payment.currency)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-slate-600">{d.payment.final_invoice_amount !== null ? 'Final invoice amount' : 'Order amount'}</dt><dd className="font-medium tabular-nums">{money(total, d.payment.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Payment received</dt><dd className="font-medium tabular-nums text-emerald-700">{money(d.payment.amount_received, d.payment.currency)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="font-medium text-slate-900">Balance due</dt>
                <dd className={cx('font-semibold tabular-nums', d.payment.balance_due !== null && d.payment.balance_due > 0 ? 'text-brand-indigo' : 'text-emerald-700')}>
                  {d.payment.balance_due === null ? '—' : d.payment.balance_due <= 0 ? 'Paid in full' : money(d.payment.balance_due, d.payment.currency)}
                </dd>
              </div>
            </dl>
            {d.payment.payments.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {d.payment.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">{fmtDate(p.payment_date)} · {PAYMENT_TYPES[p.payment_type] || p.payment_type}</span>
                    <span className="text-right">
                      <span className="block font-medium tabular-nums">{money(p.amount, p.currency)}</span>
                      <span className={cx('block text-[11px]', p.status === 'confirmed' ? 'text-emerald-700' : 'text-blue-700')}>{PAYMENT_STATUS[p.status].customerLabel}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!done && <PaymentProof orderId={o.id} />}
          </Panel>

          {/* Documents */}
          <Panel title="Documents">
            {d.documents.length === 0 ? (
              <p className="text-sm text-slate-500">Your invoices, certificates and photos will appear here.</p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {d.documents.map((doc) => (
                  <li key={doc.id}>
                    <button onClick={() => setViewing({ path: doc.storage_path, name: doc.name, mime: doc.mime_type })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-cream-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-brand-indigo"><FileText className="h-5 w-5" strokeWidth={1.5} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{doc.name}</span>
                        <span className="block text-xs text-slate-500">{DOC_TYPES[doc.doc_type]?.label || 'Document'} · {fmtDate(doc.created_at)}{doc.size_bytes ? ` · ${fileSize(doc.size_bytes)}` : ''}</span>
                      </span>
                      <Download className="h-5 w-5 shrink-0 text-brand-indigo" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Shipping */}
          <Panel title="Live Tracking">
            {d.shipments.length === 0 ? (
              <p className="text-sm text-slate-500">Shipment tracking will appear here once available.</p>
            ) : (
              <ul className="space-y-3">
                {d.shipments.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">{s.status === 'delivered' ? <PackageCheck className="h-4 w-4 text-emerald-600" /> : <Truck className="h-4 w-4 text-brand-indigo" />}{s.courier}</span>
                      <span className={cx('text-xs font-medium', s.status === 'delivered' ? 'text-emerald-700' : 'text-brand-indigo')}>{SHIPMENT_STATUS[s.status].label}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[13px]">
                      {s.tracking_number && <><dt className="text-slate-500">Tracking number</dt><dd className="font-medium">{s.tracking_number}</dd></>}
                      {s.shipped_date && <><dt className="text-slate-500">Shipped</dt><dd>{fmtDate(s.shipped_date)}</dd></>}
                      {s.status !== 'delivered' && s.estimated_delivery_date && <><dt className="text-slate-500">Estimated delivery</dt><dd>{fmtDate(s.estimated_delivery_date)}</dd></>}
                      {s.delivered_at && <><dt className="text-slate-500">Delivered</dt><dd>{fmtDate(s.delivered_at)}</dd></>}
                    </dl>
                    {s.tracking_url && s.id !== activeShipment?.id && (
                      <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-brand-ink transition hover:brightness-95">
                        <Truck className="h-4 w-4" /> Track Shipment <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <ExecutiveCard exec={d.executive} orderRef={o.reference} />
          {done && <Feedback orderId={o.id} rating={o.feedback_rating} comment={o.feedback_comment} />}
        </div>}
      </div>

      {d.updates.length > 1 && (
        <Panel title="Recent updates" className="mt-6">
          <ul className="space-y-3">
            {d.updates.slice(0, 10).map((u) => (
              <li key={u.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                <div>
                  <p className="text-slate-800"><span className="font-medium">{u.stage_name}</span>{u.note && <> — {u.note}</>}</p>
                  <p className="text-xs text-slate-500">{fmtDate(u.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <DocumentViewerModal file={viewing} onClose={closeViewer} />
    </div>
  );
}

function Feedback({ orderId, rating, comment }: { orderId: string; rating: number | null; comment: string | null }) {
  const [r, setR] = useState(rating || 0);
  const [c, setC] = useState(comment || '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!rating);
  const qc = useQueryClient();
  const toast = useToast();

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc('portal_submit_feedback', { p_order_id: orderId, p_rating: r || null, p_comment: c || null });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    setSaved(true);
    qc.invalidateQueries({ queryKey: keys.portalOrder(orderId) });
    toast.success('Thank you for your feedback');
  }

  return (
    <Panel title="How was your experience?">
      <p className="-mt-2 mb-3 text-xs text-slate-500">Optional — helps us serve you better.</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => { setR(n); setSaved(false); }} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-1">
            <Star className={cx('h-7 w-7 transition', n <= r ? 'fill-brand-amber text-brand-amber' : 'text-slate-300 hover:text-brand-amber')} />
          </button>
        ))}
      </div>
      <Textarea className="mt-3" rows={2} value={c} onChange={(e) => { setC(e.target.value); setSaved(false); }} placeholder="Anything you would like to share? (optional)" maxLength={2000} />
      <Button className="mt-3" variant={saved ? 'secondary' : 'indigo'} loading={busy} disabled={saved} onClick={submit}>{saved ? 'Feedback saved' : 'Send feedback'}</Button>
    </Panel>
  );
}

function PaymentProof({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let paymentAmount: number;
    try { paymentAmount = optionalPaymentAmount(amount); } catch (e) { return toast.error(errorMessage(e)); }
    setBusy(true);
    try {
      const path = file ? await uploadCustomerFile('order-documents', `${orderId}/customer-proof`, file, PROOF_MAX_BYTES) : null;
      const { error } = await supabase.rpc('portal_submit_payment', { p_order_id: orderId, p_path: path, p_name: file?.name.slice(0, 200) ?? '', p_amount: paymentAmount, p_reference: reference || null });
      if (error) throw error;
      setAmount(''); setReference(''); setFile(null);
      await qc.invalidateQueries({ queryKey: keys.portalOrder(orderId) });
      await qc.invalidateQueries({ queryKey: keys.portalHome });
      toast.success('Payment Submitted — awaiting verification');
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <details className="mt-4 border-t border-cream-200 pt-3"><summary className="cursor-pointer text-sm font-semibold text-brand-indigo">Upload payment proof</summary>
    <form onSubmit={submit} className="mt-3 space-y-3">
      <Field label="Payment amount"><Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <Field label="Payment reference"><Input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></Field>
      <Field label="Screenshot or bank slip"><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      <Button type="submit" variant="indigo" loading={busy}>Submit payment proof</Button>
    </form>
  </details>;
}
