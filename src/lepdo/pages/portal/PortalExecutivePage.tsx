import { Globe, Mail, MessageCircle, Phone } from 'lucide-react';
import { ErrorNote, PageLoader } from '../../components/ui';
import { ExecutiveCard } from '../../components/ExecutiveCard';
import { usePortalHome } from '../../lib/api';
import { waLink } from '../../lib/format';

export default function PortalExecutivePage() {
  const { data, isLoading, error } = usePortalHome();
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorNote error={error} />;
  const co = data.company;
  const wa = waLink(co.whatsapp);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-indigo">Assigned Executive</h1>
      <p className="mt-1 text-sm text-slate-500">Your direct contact at LEPDO for every order.</p>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {data.executive ? <ExecutiveCard exec={data.executive} /> : <p className="text-sm text-slate-500">An executive will be assigned to you shortly.</p>}
        {(co.email || co.phone || co.whatsapp || co.website) && (
          <section className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">{co.company_name}</p>
            <p className="mt-1 text-sm text-slate-500">General contact</p>
            <dl className="mt-4 space-y-2 text-sm">
              {co.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /><a className="hover:text-brand-indigo" href={`mailto:${co.email}`}>{co.email}</a></div>}
              {co.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /><a className="hover:text-brand-indigo" href={`tel:${co.phone.replace(/[^\d+]/g, '')}`}>{co.phone}</a></div>}
              {wa && <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-slate-400" /><a className="hover:text-brand-indigo" href={wa} target="_blank" rel="noopener noreferrer">{co.whatsapp}</a></div>}
              {co.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-slate-400" /><a className="hover:text-brand-indigo" href={co.website} target="_blank" rel="noopener noreferrer">{co.website.replace(/^https?:\/\//, '')}</a></div>}
            </dl>
          </section>
        )}
      </div>
    </>
  );
}
