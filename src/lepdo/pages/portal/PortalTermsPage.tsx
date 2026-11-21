import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorNote, PageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { run, usePortalHome } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { errorMessage, fmtDate } from '../../lib/format';

export default function PortalTermsPage() {
  const home = usePortalHome();
  const qc = useQueryClient();
  const toast = useToast();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const terms = useQuery({ queryKey: ['terms'], queryFn: () => run<{ version: string; effective_date: string; body: string }[]>(supabase.from('terms_versions').select('*').eq('published', true).lte('effective_date', new Date().toISOString().slice(0, 10)).order('effective_date', { ascending: false }).limit(1)) });
  const version = terms.data?.[0];
  const acceptance = useQuery({ queryKey: ['terms-acceptance', home.data?.customer.id, version?.version], enabled: !!home.data && !!version, queryFn: () => run<{ accepted_at: string }[]>(supabase.from('terms_acceptance').select('accepted_at').eq('customer_id', home.data?.customer.id).eq('version', version?.version)) });
  async function accept() {
    if (!checked || !version) return;
    setBusy(true);
    try {
      await run(supabase.rpc('portal_accept_terms', { p_version: version.version }));
      await qc.invalidateQueries({ queryKey: ['terms-acceptance'] });
      toast.success('Terms accepted');
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  }
  if (terms.isLoading) return <PageLoader />;
  return <>
    <h1 className="text-2xl font-semibold text-brand-indigo">Terms & Conditions</h1>
    <ErrorNote error={terms.error || acceptance.error} />
    {version ? <>
      <p className="mt-2 text-sm text-muted-foreground">Version {version.version} · Effective {fmtDate(version.effective_date)}</p>
      <ol className="mt-8 space-y-5 border-y border-cream-200 py-6">{version.body.split('\n').filter(Boolean).map((line, i) => <li key={line} className="flex gap-4 text-sm leading-relaxed"><span className="font-semibold text-brand-orange">{i + 1}.</span><span>{line}</span></li>)}</ol>
      {acceptance.data?.length ? <p className="mt-6 text-sm text-brand-indigo">Accepted {fmtDate(acceptance.data[0].accepted_at)}</p> : <div className="mt-6 space-y-4">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1 accent-brand-indigo" />I have read and accept LEPDO’s Terms & Conditions.</label>
        <Button variant="indigo" disabled={!checked || acceptance.isLoading} loading={busy} onClick={accept}>Accept terms</Button>
      </div>}
    </> : <p className="mt-6 text-sm text-muted-foreground">Terms are awaiting publication.</p>}
  </>;
}