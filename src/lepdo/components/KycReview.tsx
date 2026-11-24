import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorNote, Field, Select, Textarea } from './ui';
import { useToast } from './Toast';
import { getKyc, previewKyc } from '../lib/portal-management';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { errorMessage, fmtDate } from '../lib/format';

export function KycReview({ customerId }: { customerId: string }) {
  const { isOperator } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['kyc', customerId], queryFn: () => getKyc(customerId) });
  const [status, setStatus] = useState('Approved');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const record = query.data?.[0];
  async function review() {
    if (!record) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('review_kyc', { p_id: record.id, p_status: status, p_reason: reason || null });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['kyc', customerId] });
      toast.success('KYC review saved');
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <section className="border-y border-cream-200 py-5">
    <h2 className="font-semibold text-brand-indigo">KYC review</h2>
    <ErrorNote error={query.error} />
    <p className="mt-2 text-sm">{record?.status || 'Not Submitted'}{record?.submitted_at && ` · ${fmtDate(record.submitted_at)}`}</p>
    {record?.document_url && <Button className="mt-3" onClick={() => { if (record.document_url) previewKyc(record.document_url).catch(err => toast.error(errorMessage(err))); }}>View KYC document</Button>}
    {isOperator && record && <div className="mt-4 space-y-3">
      <Field label="Review result"><Select value={status} onChange={e => setStatus(e.target.value)}><option>Approved</option><option>Rejected</option><option>Re-KYC</option></Select></Field>
      {status !== 'Approved' && <Field label="Reason"><Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></Field>}
      <Button variant="indigo" loading={busy} onClick={review}>Save KYC review</Button>
    </div>}
  </section>;
}