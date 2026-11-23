import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Plus, ChevronDown, Lock, Paperclip, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Drawer, Field, Input, ProgressBar, Select, Textarea, Toggle, cx } from '../../../components/ui';
import { StatusIcon } from '../../../components/StatusIcon';
import { useToast } from '../../../components/Toast';
import { orderKeys, uploadDocument, useSettings } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { StepControls, stageHasControls } from './WorkflowSection';
import { WorkflowEditor } from '../../../components/WorkflowEditor';
import { orderWorkflow, schemaForStage } from '../../../lib/workflow-editor';
import { supabase } from '../../../lib/supabase';
import { errorMessage, fmtDate, timeAgo } from '../../../lib/format';
import { STAGE_STATUS, STAGE_STATUS_OPTIONS, docTypeForStage, canEditOrderSteps, moveStageIds, validateNewStageName } from '../../../lib/workflows';
import type { OrderListRow, OrderUpdate, Stage, StageStatus } from '../../../lib/types';

export function ProgressSection({ order, stages, updates, onUpdate }: { order: OrderListRow; stages: Stage[]; updates: OrderUpdate[]; onUpdate: (stageId?: string) => void }) {
  const [showHistory, setShowHistory] = useState(false);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  /** Where a new step is being inserted: 'start', or the id of the step it goes after. */
  const [addAt, setAddAt] = useState<string | null>(null);
  const [addName, setAddName] = useState('');
  const settings = useSettings();
  const canEdit = !!settings.data && canEditOrderSteps(isAdmin, order.status, stages, settings.data.edit_running_order_steps);
  const showControls = order.status === 'active';

  useEffect(() => {
    if (!canEdit) { setEditing(false); setRenameId(null); setAddAt(null); }
  }, [canEdit]);

  async function mutate(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    if (busy || !canEdit) return false;
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      orderKeys(order.id).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, dir: -1 | 1) {
    const ids = moveStageIds(stages.map((x) => x.id), index, dir);
    if (!ids) return;
    return mutate(() => supabase.rpc('staff_reorder_stages', { p_order_id: order.id, p_stage_ids: ids }), 'Step order saved');
  }
  async function saveRename(id: string) {
    const name = renameValue.trim() || 'Untitled step';
    await mutate(() => supabase.rpc('staff_rename_stage', { p_stage_id: id, p_name: name.slice(0, 120) }), 'Step renamed');
    setRenameId(null);
  }
  async function saveAdd() {
    if (!addAt || !canEdit || busy) return;
    let name: string;
    try { name = validateNewStageName(addName); } catch (e) { return toast.error(errorMessage(e)); }
    const saved = await mutate(() => supabase.rpc('staff_add_stage', { p_order_id: order.id, p_name: name, p_after_stage_id: addAt === 'start' ? null : addAt }), 'Step added');
    if (saved) { setAddAt(null); setAddName(''); }
  }
  function addSlot(at: string) {
    if (!editing || !canEdit) return null;
    if (addAt === at) {
      return (
        <li className="mb-4 ml-10">
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); saveAdd(); }}>
            <Input autoFocus className="min-w-0 flex-1 basis-32" aria-label="New step name" placeholder="New step name" value={addName} maxLength={120} onChange={(e) => setAddName(e.target.value)} />
            <Button size="sm" variant="indigo" type="submit" loading={busy}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddAt(null); setAddName(''); }}>Cancel</Button>
          </form>
        </li>
      );
    }
    return (
      <li className="mb-4 ml-10">
        <Button size="sm" variant="ghost" className="border border-dashed border-border text-muted-foreground" aria-label={at === 'start' ? 'Add step at start' : `Add step after ${stages.find(stage => stage.id === at)?.name || 'step'}`} disabled={busy} onClick={() => { setAddAt(at); setAddName(''); setRenameId(null); }}>
          <Plus className="h-3 w-3" /> Add step here
        </Button>
      </li>
    );
  }
  function remove(id: string, name: string) {
    if (!window.confirm(`Delete the step "${name}" from this order? Its history stays, but the step is removed from tracking.`)) return;
    return mutate(() => supabase.rpc('staff_delete_stage', { p_stage_id: id }), 'Step deleted');
  }

  return (
    <Card
      title="Order Progress"
      action={<div className="flex items-center gap-2">
        {canEdit && <Button size="sm" variant={editing ? 'indigo' : 'secondary'} icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditing((v) => !v); setRenameId(null); setAddAt(null); }}>{editing ? 'Done' : 'Edit steps'}</Button>}
        <Button size="sm" variant="primary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => onUpdate()}>Update Progress</Button>
      </div>}
    >
      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium text-brand-indigo">{order.progress_pct}% complete</span>
          <span className="text-xs text-slate-500">{stages.filter((s) => s.status === 'completed').length} of {stages.filter((s) => s.status !== 'not_applicable').length} stages</span>
        </div>
        <ProgressBar value={order.progress_pct} />
      </div>

      <ol className="relative">
        {addSlot('start')}
        {stages.map((s, i) => {
          const isCurrent = order.status === 'active' && s.stage_key === order.current_stage_key && s.status !== 'completed';
          const defs = schemaForStage(order.order_type, s).fields;
          const ticked = defs.filter((d) => s.details?.[d.key]);
          const last = i === stages.length - 1;
          return (
            <Fragment key={s.id}>
            <li className={cx('relative flex gap-3', last && !editing ? 'pb-0' : 'pb-4')}>
              {!last && <span className={cx('absolute left-[13px] top-8 h-[calc(100%-1.75rem)] w-0.5', s.status === 'completed' ? 'bg-emerald-500/60' : 'bg-slate-200')} />}
              <StatusIcon status={s.status} current={isCurrent} />
              <div className={cx('min-w-0 flex-1 rounded-lg px-2 py-1 -mx-2 -my-1', isCurrent && 'bg-cream-50')}>
                {editing && canEdit && renameId === s.id ? (
                  <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); saveRename(s.id); }}>
                    <Input autoFocus aria-label="Step name" value={renameValue} maxLength={120} onChange={(e) => setRenameValue(e.target.value)} />
                    <Button size="sm" variant="indigo" type="submit" loading={busy}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenameId(null)}>Cancel</Button>
                  </form>
                ) : (
                <div className="flex items-center gap-1">
                <button className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left" onClick={() => onUpdate(s.id)}>
                  <span className={cx('text-sm font-medium', s.status === 'not_applicable' ? 'text-slate-400 line-through' : s.status === 'upcoming' && !isCurrent ? 'text-slate-500' : 'text-slate-900')}>{s.name}</span>
                  {s.status !== 'upcoming' && s.status !== 'completed' && (
                    <Badge tone={s.status === 'attention' ? 'amber' : s.status === 'blocked' ? 'red' : s.status === 'in_progress' ? 'indigo' : 'grey'}>{STAGE_STATUS[s.status].label}</Badge>
                  )}
                  {isCurrent && s.status === 'upcoming' && <Badge tone="indigo">Next</Badge>}
                  {s.is_payment_stage && <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">payment</span>}
                  <span className="ml-auto text-xs text-slate-500">{s.completed_at ? fmtDate(s.completed_at) : ''}</span>
                  <span className="text-xs font-medium text-brand-indigo opacity-0 transition group-hover:opacity-100">Update</span>
                </button>
                {editing && canEdit && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <Button size="sm" variant="ghost" aria-label={`Move ${s.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
                    <Button size="sm" variant="ghost" aria-label={`Move ${s.name} down`} disabled={busy || last} onClick={() => move(i, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
                    <Button size="sm" variant="ghost" aria-label={`Rename ${s.name}`} disabled={busy} onClick={() => { setRenameId(s.id); setRenameValue(s.name); }} icon={<Pencil className="h-3.5 w-3.5" />} />
                    <Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} disabled={busy} onClick={() => remove(s.id, s.name)} icon={<Trash2 className="h-3.5 w-3.5 text-red-600" />} />
                  </span>
                )}
                </div>
                )}
                {s.ui_schema?.description && <p className="mt-1 text-sm text-muted-foreground">{s.ui_schema.description}</p>}
                {s.customer_note && <p className="mt-0.5 text-[13px] text-slate-600">“{s.customer_note}”</p>}
                {(defs.length > 0 || (showControls && stageHasControls(order, s.stage_key))) && (
                  <div className="mt-1">
                    <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-indigo" onClick={() => setOpenDetails(openDetails === s.id ? null : s.id)}>
                      {defs.length > 0 ? `${ticked.length}/${defs.length} details` : 'Controls'} <ChevronDown className={cx('h-3 w-3 transition', openDetails === s.id && 'rotate-180')} />
                    </button>
                    {openDetails === s.id && defs.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {defs.map((d) => (
                          <li key={d.key} className="flex items-center gap-2 text-xs">
                            {s.details?.[d.key] ? <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} /> : <span className="ml-0.5 h-2.5 w-2.5 rounded-full border border-slate-300" />}
                            <span className={s.details?.[d.key] ? 'text-slate-700' : 'text-slate-400'}>{d.label}{d.type !== 'checkbox' && s.details?.[d.key] ? `: ${s.details[d.key]}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {openDetails === s.id && showControls && stageHasControls(order, s.stage_key) && <StepControls order={order} stages={stages} stage={s} />}
                  </div>
                )}
              </div>
            </li>
            {addSlot(s.id)}
            </Fragment>
          );
        })}
      </ol>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <button className="inline-flex items-center gap-1 text-sm font-medium text-brand-indigo" onClick={() => setShowHistory((v) => !v)}>
          Update history ({updates.length}) <ChevronDown className={cx('h-4 w-4 transition', showHistory && 'rotate-180')} />
        </button>
        {showHistory && (
          updates.length === 0 ? <p className="mt-3 text-sm text-slate-500">No updates yet.</p> : (
            <ul className="mt-3 space-y-3">
              {updates.map((u) => (
                <li key={u.id} className="flex gap-3 text-sm">
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', u.customer_visible ? 'bg-brand-indigo' : 'bg-slate-300')} />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800">
                      <span className="font-medium">{u.stage_name}</span>
                      {u.status && STAGE_STATUS[u.status as StageStatus] && <span className="text-slate-500"> → {STAGE_STATUS[u.status as StageStatus].label}</span>}
                      {!u.customer_visible && <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-slate-500"><Lock className="h-3 w-3" /> internal</span>}
                    </p>
                    {u.note && <p className="text-slate-600">{u.note}</p>}
                    <p className="text-xs text-slate-400">{u.author?.full_name || 'System'} · {timeAgo(u.created_at)}{u.document_id && <> · <Paperclip className="inline h-3 w-3" /> file</>}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Card>
  );
}

export function UpdateProgressDrawer({ open, onClose, order, stages, initialStageId }: { open: boolean; onClose: () => void; order: OrderListRow; stages: Stage[]; initialStageId?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [customizing, setCustomizing] = useState(false);
  const [stageId, setStageId] = useState('');
  const [status, setStatus] = useState<StageStatus>('completed');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);

  function pickStage(id: string) {
    const s = stages.find((x) => x.id === id);
    setStageId(id);
    setDetails({ ...(s?.details || {}) });
    setStatus(!s || s.status === 'upcoming' || s.status === 'in_progress' ? 'completed' : s.status);
  }

  useEffect(() => {
    if (!open) return;
    const fallback = stages.find((s) => s.stage_key === order.current_stage_key) || stages[0];
    pickStage(initialStageId || fallback?.id || '');
    setCustomizing(false);
    setNote('');
    setVisible(true);
    setFile(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !stage) return;
    setBusy(true);
    setError(null);
    try {
      let documentId: string | null = null;
      if (file) {
        const doc = await uploadDocument(order.id, file, { doc_type: docTypeForStage(stage.stage_key), customer_visible: visible, name: file.name });
        documentId = doc.id;
      }
      const { error } = await supabase.rpc('record_stage_update', {
        p_stage_id: stage.id,
        p_status: status,
        p_note: note.trim() || null,
        p_customer_visible: visible,
        p_details: details,
        p_document_id: documentId,
      });
      if (error) throw error;
      orderKeys(order.id).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(visible ? 'Progress updated — visible to the customer now' : 'Progress updated (internal)');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const defs = stage ? schemaForStage(order.order_type, stage).fields : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Update progress"
      subtitle={`${order.reference} · ${order.customer_name}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {!customizing && <Button variant="primary" type="submit" form="progress-form" loading={busy}>Save Update</Button>}
      </>}
    >
      {isAdmin && <Button className="mb-4" icon={<Pencil className="h-4 w-4" />} onClick={() => setCustomizing(v => !v)}>{customizing ? 'Back to progress' : 'Customize order stages'}</Button>}
      {customizing ? <WorkflowEditor initial={orderWorkflow(order.order_type, stages)} onSave={async definition => {
        const { error } = await supabase.rpc('admin_save_order_workflow', { p_order_id: order.id, p_definition: definition });
        if (error) throw error;
        await Promise.all(orderKeys(order.id).map(k => qc.invalidateQueries({ queryKey: k })));
        onClose();
      }} /> : <form id="progress-form" onSubmit={save} className="space-y-5">
        <Field label="Stage">
          <Select value={stageId} onChange={(e) => pickStage(e.target.value)}>
            {stages.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.name}{s.status === 'completed' ? ' ✓' : ''}</option>)}
          </Select>
        </Field>

        <Field label="Status" group>
          <div className="grid grid-cols-2 gap-2">
            {STAGE_STATUS_OPTIONS.map((st) => (
              <button
                type="button"
                key={st}
                onClick={() => setStatus(st)}
                className={cx('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition',
                  status === st ? 'border-brand-indigo bg-cream-100 font-medium text-brand-indigo ring-1 ring-brand-indigo' : 'border-slate-200 text-slate-700 hover:border-slate-300')}
              >
                <StatusIcon status={st} size="sm" current={st === 'in_progress'} />
                {STAGE_STATUS[st].label}
              </button>
            ))}
          </div>
          {stage?.is_payment_stage && status === 'completed' && (
            <p className="mt-2 text-xs text-amber-800">Payment stage: mark completed only when the payment is actually confirmed received.</p>
          )}
          {(status === 'completed' || status === 'in_progress') && stage && stages.some((s) => s.journey_position < stage.journey_position && !s.is_payment_stage && (s.status === 'upcoming' || s.status === 'in_progress')) && (
            <p className="mt-2 text-xs text-slate-500">Earlier open stages (except payment stages) will be marked completed automatically.</p>
          )}
        </Field>

        {defs.length > 0 && (
          <Field label="Details (optional)" group>
            <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
              {defs.map(d => d.type === 'checkbox' ? (
                <label key={d.key} className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                  <input type="checkbox" className="h-4 w-4" checked={!!details[d.key]} onChange={e => setDetails(cur => ({ ...cur, [d.key]: e.target.checked ? new Date().toISOString() : '' }))} />
                  <span>{d.label}{d.description && <span className="block text-xs text-muted-foreground">{d.description}</span>}</span>
                </label>
              ) : <Field key={d.key} label={d.label} hint={d.description}>
                {d.type === 'textarea' ? <Textarea value={details[d.key] ?? ''} onChange={e => setDetails(cur => ({ ...cur, [d.key]: e.target.value }))} /> : <Input type={d.type} value={details[d.key] ?? ''} onChange={e => setDetails(cur => ({ ...cur, [d.key]: e.target.value }))} />}
              </Field>)}
            </div>
          </Field>
        )}

        <Field label="Short note (optional)">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={visible ? 'e.g. Your diamond has passed quality check.' : 'Internal note for the team'} />
        </Field>

        <Toggle checked={visible} onChange={setVisible} label="Visible to customer" hint={visible ? 'The note appears in the customer portal immediately.' : 'Only LEPDO team members will see this note and file.'} />

        <Field label="Document or image (optional)">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-indigo" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>}
    </Drawer>
  );
}
