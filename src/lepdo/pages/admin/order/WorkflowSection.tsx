import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Select, Textarea, Toggle } from '../../../components/ui';
import { useToast } from '../../../components/Toast';
import { DocumentViewerModal, type ViewerFile } from '../../../components/DocumentViewerModal';
import { orderKeys, run, uploadDocument } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { errorMessage, fmtDate } from '../../../lib/format';
import { APPROVAL_STATUS, INVOICE_STEPS, parseInvoiceAmount } from '../../../lib/workflows';
import type { OrderApproval, OrderListRow, Stage } from '../../../lib/types';

interface Metal { id: string; metal_type: string; metal_purity: string | null; metal_weight: number | null; status: string; supplied_date: string | null; notes: string | null }
interface Photo { id: string; status: string; assigned_to: string | null; notes: string | null }

/** Steps that can receive a versioned approval upload (same set as before). */
export const APPROVAL_UPLOAD_STEPS = ['diamond_preparation', 'cad_approval', 'quality_check'];

/** Whether a step has any staff controls (used to show the expand arrow). */
export function stageHasControls(order: OrderListRow, stageKey: string) {
  return stageKey in INVOICE_STEPS || APPROVAL_UPLOAD_STEPS.includes(stageKey) || (order.order_type === 'jewellery' && stageKey === 'manufacturing');
}

/**
 * Staff tools for one step: start preparing, versioned customer approvals,
 * metal supply and photography. Rendered under the step inside Order Progress.
 */
export function StepControls({ order, stages, stage }: { order: OrderListRow; stages: Stage[]; stage: Stage }) {
  const qc = useQueryClient();
  const toast = useToast();
  const id = order.id;
  const key = stage.stage_key;
  const jewellery = order.order_type === 'jewellery';
  const hasApprovals = APPROVAL_UPLOAD_STEPS.includes(key);
  const approvals = useQuery({ queryKey: ['approvals', id], enabled: hasApprovals, queryFn: () => run<OrderApproval[]>(supabase.from('order_approvals').select('*').eq('order_id', id).order('version', { ascending: false })) });
  const metals = useQuery({ queryKey: ['metal', id], enabled: jewellery && key === 'manufacturing', queryFn: () => run<Metal[]>(supabase.from('metal_supplies').select('*').eq('order_id', id).order('created_at')) });
  const photo = useQuery({ queryKey: ['photo', id], enabled: jewellery && key === 'quality_check', queryFn: () => run<Photo | null>(supabase.from('photography_tasks').select('*').eq('order_id', id).maybeSingle()) });
  const [viewing, setViewing] = useState<ViewerFile | null>(null);
  const close = useCallback(() => setViewing(null), []);
  const refresh = () => Promise.all([...orderKeys(id), ['approvals', id], ['metal', id], ['photo', id]].map(k => qc.invalidateQueries({ queryKey: k })));
  async function act(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    try { const { error } = await fn(); if (error) throw error; await refresh(); toast.success(ok); } catch (e) { toast.error(errorMessage(e)); }
  }

  // Start preparing
  const [prepNote, setPrepNote] = useState(''); const [prepBy, setPrepBy] = useState(''); const [waiver, setWaiver] = useState('');
  const unpaid = (order.balance_due ?? 0) > 0;
  const showPrep = key === 'diamond_preparation' && stage.status !== 'completed' && stage.status !== 'in_progress';
  const stageApprovals = (approvals.data || []).filter(a => a.stage_key === key);

  return (
    <div className="mt-2 space-y-4 rounded-lg border border-cream-200 p-3">
      {key in INVOICE_STEPS && <InvoiceUpload order={order} stage={stage} />}
      {showPrep && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-indigo">Start Preparing</h3>
          <Field label="Started by"><Input value={prepBy} onChange={e => setPrepBy(e.target.value)} maxLength={120} /></Field>
          <Field label="Notes"><Textarea rows={2} value={prepNote} onChange={e => setPrepNote(e.target.value)} /></Field>
          {unpaid && <Field label="Payment waiver reason" hint="Required — order is not fully paid"><Input value={waiver} onChange={e => setWaiver(e.target.value)} /></Field>}
          <Button className="min-h-11" variant="indigo" disabled={unpaid && !waiver.trim()} onClick={() => act(() => supabase.rpc('record_stage_update', { p_stage_id: stage.id, p_status: 'in_progress', p_note: prepNote || 'Preparation started.', p_customer_visible: true, p_details: { preparation_started: new Date().toISOString(), started_by: prepBy, ...(waiver ? { payment_waiver: waiver } : {}) }, p_document_id: null }), 'Preparation started')}>Start Preparing</Button>
        </section>
      )}

      {hasApprovals && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-indigo">Approvals</h3>
          <ApprovalUpload order={order} stageKey={key} />
          <ul className="space-y-2">
            {stageApprovals.map(a => (
              <li key={a.id} className="rounded-xl border border-cream-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{stages.find(s => s.stage_key === a.stage_key)?.name} · v{a.version}</span>
                  <Badge tone={APPROVAL_STATUS[a.status].tone}>{APPROVAL_STATUS[a.status].label}</Badge>
                  <Badge tone={a.internal_qc_status === 'passed' ? 'green' : a.internal_qc_status === 'rework_required' ? 'red' : 'grey'}>QC: {a.internal_qc_status.replace('_', ' ')}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.file_name} · {fmtDate(a.created_at)}</p>
                {a.rejection_reason && <p className="mt-1 text-xs text-red-700">{a.rejection_reason}: {a.rejection_notes}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setViewing({ path: a.file_path, name: a.file_name })}>View</Button>
                  {a.status !== 'superseded' && <>
                    <Button variant="ghost" onClick={() => act(() => supabase.from('order_approvals').update({ internal_qc_status: 'passed' }).eq('id', a.id), 'QC passed')}>QC pass</Button>
                    <Button variant="ghost" onClick={() => act(() => supabase.from('order_approvals').update({ internal_qc_status: 'rework_required' }).eq('id', a.id), 'Marked for rework')}>QC rework</Button>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {jewellery && key === 'manufacturing' && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-indigo">Metal Supply</h3>
          {(metals.data || []).map(x => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{x.metal_type} {x.metal_purity} · {x.metal_weight ?? '—'} g · {x.supplied_date ? fmtDate(x.supplied_date) : 'no date'}</span>
              <Select className="w-32" value={x.status} onChange={e => act(() => supabase.from('metal_supplies').update({ status: e.target.value }).eq('id', x.id), 'Updated')}><option value="pending">Pending</option><option value="preparing">Preparing</option><option value="done">Done</option></Select>
            </div>
          ))}
          <MetalSupplyAdd orderId={id} />
        </section>
      )}

      {jewellery && key === 'quality_check' && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-indigo">Jewellery Photography</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input aria-label="Assigned to" placeholder="Assigned to" defaultValue={photo.data?.assigned_to || ''} key={photo.data?.id || 'new'} onBlur={e => act(() => supabase.from('photography_tasks').upsert({ order_id: id, assigned_to: e.target.value || null, status: photo.data?.status || 'pending' }, { onConflict: 'order_id' }), 'Saved')} />
            <Select value={photo.data?.status || 'pending'} onChange={e => act(() => supabase.from('photography_tasks').upsert({ order_id: id, status: e.target.value, completed_at: e.target.value === 'completed' ? new Date().toISOString() : null }, { onConflict: 'order_id' }), 'Photography updated')}>
              <option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Upload finished photos under Documents as “Jewellery Photo” so the customer can see them.</p>
        </section>
      )}
      <DocumentViewerModal file={viewing} onClose={close} />
    </div>
  );
}

/** Issue the proforma / final invoice from its own step: file, amount, visibility and step completion. */
function InvoiceUpload({ order, stage }: { order: OrderListRow; stage: Stage }) {
  const cfg = INVOICE_STEPS[stage.stage_key];
  return cfg ? <InvoiceUploadForm order={order} stage={stage} cfg={cfg} /> : null;
}

function InvoiceUploadForm({ order, stage, cfg }: { order: OrderListRow; stage: Stage; cfg: NonNullable<(typeof INVOICE_STEPS)[string]> }) {
  const toast = useToast();
  const refresh = useRefreshOrder(order.id);
  const current = order[cfg.amountField];
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(current?.toString() ?? '');
  const [visible, setVisible] = useState(true);
  const [complete, setComplete] = useState(!stage.is_payment_stage);
  const [busy, setBusy] = useState(false);
  const alreadyDone = stage.status === 'completed';

  async function save() {
    if (busy) return;
    let num: number | null;
    try { num = parseInvoiceAmount(amount); } catch (e) { return toast.error(errorMessage(e)); }
    const amountChanged = num !== current;
    const completing = complete && !alreadyDone;
    if (!file && !amountChanged && !completing) { toast.success('Invoice details saved'); return; }
    setBusy(true);
    try {
      if (amountChanged) {
        const { error } = await supabase.from('orders').update({ [cfg.amountField]: num }).eq('id', order.id);
        if (error) throw error;
      }
      let documentId: string | null = null;
      if (file) documentId = (await uploadDocument(order.id, file, { doc_type: cfg.docType, customer_visible: visible })).id;
      if (file || completing) {
        const details = cfg.detailKey && completing ? { ...(stage.details || {}), [cfg.detailKey]: new Date().toISOString() } : null;
        const { error } = await supabase.rpc('record_stage_update', {
          p_stage_id: stage.id,
          p_status: completing ? 'completed' : stage.status,
          p_note: file && visible ? `${cfg.label} issued.` : null,
          p_customer_visible: visible,
          p_details: details,
          p_document_id: documentId,
        });
        if (error) throw error;
      }
      setFile(null);
      await refresh();
      toast.success(file ? (visible ? `${cfg.label} shared with the customer` : `${cfg.label} saved (internal)`) : 'Invoice details saved');
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-brand-indigo">{cfg.label}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Invoice file"><Input key={file ? 'selected' : 'empty'} type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
        <Field label={`Amount (${order.currency})`}><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field>
      </div>
      <Toggle checked={visible} onChange={setVisible} label="Visible to customer" hint={visible ? 'Appears under Invoices in the customer portal.' : 'Only LEPDO team members will see this file.'} />
      {!alreadyDone && <Toggle checked={complete} onChange={setComplete} label={`Mark “${stage.name}” completed`} {...(stage.is_payment_stage ? { hint: 'Payment step: complete it only when appropriate.' } : {})} />}
      <Button className="min-h-11" variant="indigo" loading={busy} onClick={save}>Save invoice</Button>
    </section>
  );
}

function useRefreshOrder(id: string) {
  const qc = useQueryClient();
  return () => Promise.all([...orderKeys(id), ['approvals', id], ['metal', id], ['photo', id]].map(k => qc.invalidateQueries({ queryKey: k })));
}

/** "Upload new version" control for one step. */
function ApprovalUpload({ order, stageKey }: { order: OrderListRow; stageKey: string }) {
  const toast = useToast();
  const id = order.id;
  const refresh = useRefreshOrder(id);
  const [file, setFile] = useState<File | null>(null);
  const [needsCustomer, setNeedsCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  async function requestApproval() {
    if (!file) return toast.error('Choose a file.');
    setBusy(true);
    try {
      const type = stageKey === 'cad_approval' ? 'cad' : stageKey === 'quality_check' ? (order.order_type === 'diamond' ? 'diamond_qc' : 'jewellery_qc') : 'custom';
      const doc = await uploadDocument(id, file, { doc_type: stageKey === 'cad_approval' ? 'cad_design' : 'qc_image', customer_visible: true });
      const { error } = await supabase.rpc('staff_request_approval', { p_order_id: id, p_stage_key: stageKey, p_approval_type: type, p_file_path: doc.storage_path, p_file_name: doc.name, p_document_id: doc.id, p_customer_required: needsCustomer });
      if (error) throw error;
      setFile(null); await refresh(); toast.success('Version shared');
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <Field label="File"><Input key={file ? 'selected' : 'empty'} type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      <Toggle checked={needsCustomer} onChange={setNeedsCustomer} label="Customer approval required" />
      <Button className="min-h-11" variant="indigo" loading={busy} onClick={requestApproval}>Upload new version</Button>
    </div>
  );
}

/** "Add metal supply" control for the manufacturing step. */
function MetalSupplyAdd({ orderId }: { orderId: string }) {
  const toast = useToast();
  const refresh = useRefreshOrder(orderId);
  const [m, setM] = useState({ metal_type: 'Gold', metal_purity: '18K', metal_weight: '', status: 'pending', supplied_date: '' });
  async function add() {
    try {
      const { error } = await supabase.from('metal_supplies').insert({ order_id: orderId, metal_type: m.metal_type, metal_purity: m.metal_purity || null, metal_weight: m.metal_weight ? Number(m.metal_weight) : null, supplied_date: m.supplied_date || null, status: m.supplied_date ? 'done' : 'pending' });
      if (error) throw error;
      await refresh(); toast.success('Metal supply added');
    } catch (e) { toast.error(errorMessage(e)); }
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input aria-label="Metal type" value={m.metal_type} onChange={e => setM({ ...m, metal_type: e.target.value })} />
        <Input aria-label="Purity" value={m.metal_purity} onChange={e => setM({ ...m, metal_purity: e.target.value })} />
        <Input aria-label="Weight (g)" placeholder="Weight g" type="number" step="0.01" value={m.metal_weight} onChange={e => setM({ ...m, metal_weight: e.target.value })} />
        <Input aria-label="Supply date" type="date" value={m.supplied_date} onChange={e => setM({ ...m, supplied_date: e.target.value })} />
      </div>
      <Button variant="secondary" onClick={add}>Add metal supply</Button>
    </div>
  );
}
