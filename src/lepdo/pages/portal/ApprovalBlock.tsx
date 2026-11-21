import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Eye } from 'lucide-react';
import { Badge, Button, Field, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { keys, openDocument } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { errorMessage, fmtDate } from '../../lib/format';
import { APPROVAL_STATUS, REJECTION_REASONS } from '../../lib/workflows';
import type { PortalApproval } from '../../lib/types';
import type { ViewerFile } from '../../components/DocumentViewerModal';

/** Versioned approval for one journey step: approve, request changes, revision history. */
export function ApprovalBlock({ orderId, approvals, canAct, onView }: { orderId: string; approvals: PortalApproval[]; canAct: boolean; onView: (f: ViewerFile) => void }) {
  const [mode, setMode] = useState<'none' | 'approve' | 'reject'>('none');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const [current, ...history] = approvals;
  if (!current) return null;
  const pending = current.status === 'pending' && current.customer_approval_required;

  async function decide(decision: 'approved' | 'changes_requested') {
    if (decision === 'changes_requested' && (!reason || !notes.trim())) return toast.error('Choose a reason and add notes.');
    setBusy(true);
    try {
      const { error } = await supabase.rpc('portal_decide_approval', { p_approval_id: current!.id, p_decision: decision, p_reason: reason || null, p_notes: notes || null });
      if (error) throw error;
      setMode('none'); setReason(''); setNotes('');
      await qc.invalidateQueries({ queryKey: keys.portalOrder(orderId) });
      toast.success(decision === 'approved' ? 'Approved — thank you' : 'Change request sent');
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className={pending ? 'rounded-xl border border-brand-amber bg-amber-50/60 p-3' : 'rounded-xl border border-cream-200 p-3'}>
      <div className="flex flex-wrap items-center gap-2">
        {pending && <p className="text-sm font-semibold text-brand-indigo">Approval Required</p>}
        <Badge tone="indigo">Version {current.version}</Badge>
        <Badge tone={APPROVAL_STATUS[current.status].tone}>{APPROVAL_STATUS[current.status].label}</Badge>
      </div>
      <p className="mt-1 truncate text-sm text-slate-700">{current.file_name}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Button className="min-h-11" icon={<Eye className="h-4 w-4" />} onClick={() => onView({ path: current.file_path, name: current.file_name })}>View File</Button>
        <Button className="min-h-11" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => openDocument(current.file_path, current.file_name).catch(e => toast.error(errorMessage(e)))}>Download</Button>
      </div>
      {pending && canAct && mode === 'none' && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button className="min-h-11" variant="indigo" onClick={() => setMode('approve')}>Approve</Button>
          <Button className="min-h-11" variant="secondary" onClick={() => setMode('reject')}>Reject / Request Changes</Button>
        </div>
      )}
      {mode === 'approve' && (
        <div className="mt-3 rounded-lg bg-white p-3 text-sm">
          <p>Approve <strong>version {current.version}</strong> ({current.file_name})? Work will continue based on this file.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Button className="min-h-11" variant="indigo" loading={busy} onClick={() => decide('approved')}>Confirm approval</Button><Button className="min-h-11" variant="ghost" onClick={() => setMode('none')}>Cancel</Button></div>
        </div>
      )}
      {mode === 'reject' && (
        <div className="mt-3 space-y-3 rounded-lg bg-white p-3">
          <Field label="Reason" required><Select value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{REJECTION_REASONS.map(r => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Notes" required><Textarea rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the changes you need" /></Field>
          <div className="flex flex-col gap-2 sm:flex-row"><Button className="min-h-11" variant="indigo" loading={busy} onClick={() => decide('changes_requested')}>Send change request</Button><Button className="min-h-11" variant="ghost" onClick={() => setMode('none')}>Cancel</Button></div>
        </div>
      )}
      {current.status === 'changes_requested' && <p className="mt-2 text-xs text-red-700">{current.rejection_reason}: {current.rejection_notes}</p>}
      {history.length > 0 && (
        <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-brand-indigo">Revision History ({history.length})</summary>
          <ul className="mt-2 space-y-2">{history.map(h => (
            <li key={h.id} className="text-xs text-slate-600">
              <button className="font-medium text-brand-indigo underline" onClick={() => onView({ path: h.file_path, name: h.file_name })}>Version {h.version}</button> · {APPROVAL_STATUS[h.status].label} · {fmtDate(h.created_at)}
              {h.rejection_reason && <span className="block">{h.rejection_reason}: {h.rejection_notes}</span>}
            </li>))}</ul>
        </details>
      )}
    </div>
  );
}
