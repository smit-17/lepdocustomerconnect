import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { Button, ErrorNote, Field, Input, PageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { keys, usePortalHome } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { errorMessage, fmtDate } from '../../lib/format';
import { getKyc, KYC_MAX_BYTES, previewKyc, uploadCustomerFile } from '../../lib/portal-management';
import { passwordChangeError } from '../../lib/account';

export default function PortalProfilePage() {
  const { data, isLoading, error } = usePortalHome();
  const { signOut } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const customerId = data?.customer.id || '';
  const kyc = useQuery({ queryKey: ['kyc', customerId], queryFn: () => getKyc(customerId), enabled: !!customerId });
  const record = kyc.data?.[0];
  const [pw, setPw] = useState({ current: '', a: '', b: '' });
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorNote error={error} />;

  async function submitKyc(e: FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy('kyc');
    try {
      const path = await uploadCustomerFile('customer-kyc', customerId, file, KYC_MAX_BYTES);
      const { error } = await supabase.rpc('portal_submit_kyc', { p_path: path });
      if (error) throw error;
      setFile(null);
      await qc.invalidateQueries({ queryKey: ['kyc', customerId] });
      toast.success('KYC submitted for review');
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(null); }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validation = passwordChangeError(pw.current, pw.a, pw.b);
    if (validation) return toast.error(validation);
    setBusy('pw');
    const { error } = await supabase.auth.updateUser({ password: pw.a, current_password: pw.current });
    setBusy(null);
    if (error) return toast.error(error.message);
    setPw({ current: '', a: '', b: '' });
    toast.success('Password updated');
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-indigo">My Profile</h1>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CustomerProfileDetails data={data} />

        <section className="border-t border-cream-200 pt-6">
          <h2 className="text-[15px] font-semibold text-brand-indigo">KYC</h2>
          <p className="mt-2 text-sm font-medium text-brand-indigo">{record?.status || 'Not Submitted'}</p>
          {record?.submitted_at && <p className="text-xs text-muted-foreground">Submitted {fmtDate(record.submitted_at)}</p>}
          {record?.rejection_reason && <p className="mt-2 text-sm text-destructive">{record.rejection_reason}</p>}
          <ErrorNote error={kyc.error} />
          {record?.document_url && <Button className="mt-3" onClick={() => { if (record.document_url) previewKyc(record.document_url).catch(err => toast.error(errorMessage(err))); }}>View submitted document</Button>}
          {!kyc.isLoading && !['Approved', 'Under Review'].includes(record?.status || '') && <form onSubmit={submitKyc} className="mt-4 space-y-3">
            <Field label="KYC document"><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
            <Button type="submit" variant="indigo" loading={busy === 'kyc'} disabled={!file}>Submit KYC</Button>
          </form>}
        </section>
        <section className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-brand-indigo">Password</h2>
          <form onSubmit={changePw} className="space-y-4">
            <Field label="Current password"><Input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
            <Field label="Confirm password"><Input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
            <Button type="submit" loading={busy === 'pw'}>Update password</Button>
          </form>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-cream-200 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-brand-indigo">Sign out</h2>
            <p className="mt-1 text-sm text-slate-500">You can sign in again any time with your email.</p>
          </div>
          <Button className="mt-4 self-start" icon={<LogOut className="h-4 w-4" />} onClick={signOut}>Sign out</Button>
        </section>
      </div>
    </>
  );
}

export function CustomerProfileDetails({ data, readOnly = false }: { data: import('../../lib/types').PortalHome; readOnly?: boolean }) {
  const c = data.customer;
  return <>
{!readOnly && <>
        <section className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-brand-indigo">Your details</h2>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Your name</dt><dd>{data.me?.full_name || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{data.me?.email}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Phone / WhatsApp</dt><dd>{data.me?.phone || '—'}</dd></div>
          </dl>
        </section>

</>}
        <section className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-brand-indigo">Company</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-slate-500">Company</dt><dd className="font-medium text-slate-900">{c.name}</dd></div>
            {!readOnly && c.contact_person && <div><dt className="text-xs text-slate-500">Contact person</dt><dd>{c.contact_person}</dd></div>}
            <div><dt className="text-xs text-slate-500">Country</dt><dd>{c.country}</dd></div>
            {!readOnly && <div><dt className="text-xs text-slate-500">Company email</dt><dd>{c.email}</dd></div>}
            {!readOnly && c.address && <div><dt className="text-xs text-slate-500">Address</dt><dd className="whitespace-pre-line">{c.address}</dd></div>}
          </dl>
          {!readOnly && <p className="mt-4 text-xs text-slate-500">To update company details, please contact your LEPDO executive.</p>}
        </section>


  </>;
}
