import { useState } from 'react';
import { Link } from '@/lepdo/router';
import { ArrowRight, CalendarClock, Gem, Package, Sparkles } from 'lucide-react';
import { Button, ErrorNote, PageLoader, ProgressBar } from '../../components/ui';
import { StatusIcon } from '../../components/StatusIcon';
import { ExecutiveCard } from '../../components/ExecutiveCard';
import { usePortalHome } from '../../lib/api';
import { fmtDate, money, timeAgo } from '../../lib/format';
import type { PortalOrderCard } from '../../lib/types';

function OrderCard({ o, readOnly = false, onOrder, sharePath }: { o: PortalOrderCard; readOnly?: boolean; onOrder?: (id: string) => void; sharePath?: string }) {
  const done = o.status === 'completed';
  return (
    <Link to={sharePath || `/portal/orders/${o.id}`} onClick={onOrder ? e => { e.preventDefault(); onOrder(o.id); } : undefined} className="group flex flex-col rounded-2xl border border-cream-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-orange/40 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-wide text-brand-indigo">{o.reference}</p>
          <p className="mt-0.5 truncate text-[15px] text-slate-800">{o.title}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cream-100 px-2.5 py-1 text-[11px] font-medium text-brand-indigo">
          {o.order_type === 'diamond' ? <Gem className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {o.order_type === 'diamond' ? 'Diamond' : 'Jewellery'}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-2.5">
        <StatusIcon status={done ? 'completed' : o.current_stage_status || 'upcoming'} current={!done} size="sm" />
        <span className="text-sm font-medium text-slate-900">{done ? 'Delivered' : o.current_stage_name}</span>
        <span className="ml-auto text-sm font-semibold tabular-nums text-brand-indigo">{o.progress_pct}%</span>
      </div>
      <ProgressBar value={o.progress_pct} className="mt-2" />

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {!readOnly && <div><dt className="text-xs text-slate-500">Order amount</dt><dd className="font-medium tabular-nums text-slate-800">{money(o.total_amount, o.currency)}</dd></div>}
        <div>
          <dt className="text-xs text-slate-500">{done ? 'Completed' : 'Expected delivery'}</dt>
          <dd className="font-medium text-slate-800">{done ? fmtDate(o.completed_at) : o.expected_delivery_date ? fmtDate(o.expected_delivery_date) : 'To be confirmed'}</dd>
        </div>
      </dl>

      {o.latest_update?.note && (
        <p className="mt-4 line-clamp-2 rounded-xl bg-cream-50 px-3 py-2 text-[13px] text-slate-700">“{o.latest_update.note}”</p>
      )}
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="text-xs text-slate-500">Updated {timeAgo(o.updated_at)}</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-indigo group-hover:gap-2 transition-all">View Order <ArrowRight className="h-4 w-4" /></span>
      </div>
    </Link>
  );
}

export default function PortalHomePage() {
  const { data, isLoading, error } = usePortalHome();
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorNote error={error} />;
  return <PortalHomeView data={data} />;
}

export function PortalHomeView({ data, readOnly = false, onOrder, sharePath }: { data: import('../../lib/types').PortalHome; readOnly?: boolean; onOrder?: (id: string) => void; sharePath?: string }) {
  const [activeLimit, setActiveLimit] = useState(6);
  const [completedLimit, setCompletedLimit] = useState(6);
  const active = data.orders.filter((o) => o.status === 'active');
  const completed = data.orders.filter((o) => o.status === 'completed');
  const name = data.me?.full_name || data.customer.contact_person || data.customer.name;

  return (
    <>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-orange">LEPDO CONNECT</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-brand-indigo sm:text-4xl">Every Order. Every Step. Connected.</h1>
          <p className="mt-3 text-[15px] text-slate-600">Welcome, <span className="font-medium text-slate-900">{name}</span>{name !== data.customer.name && <> · {data.customer.name}</>}</p>
        </div>
        {!readOnly && <ExecutiveCard exec={data.executive} compact />}
      </section>

      <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-cream-200 py-5">
        {[['Active Orders', active.length], ['Completed Orders', completed.length], ['Total Orders', data.orders.length]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold text-brand-indigo">{value}</dd></div>)}
      </dl>
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-brand-indigo">Active Orders</h2>
          <span className="text-sm text-slate-500">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cream-200 bg-white px-6 py-10 text-center">
            <Package className="mx-auto h-6 w-6 text-brand-indigo/60" />
            <p className="mt-2 text-sm font-medium text-slate-800">No active orders yet.</p>
            <p className="mt-1 text-sm text-slate-500">New orders from LEPDO will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{active.slice(0, activeLimit).map((o) => <OrderCard key={o.id} o={o} readOnly={readOnly} {...(onOrder ? { onOrder } : {})} {...(sharePath ? { sharePath } : {})} />)}</div>
        )}
        {active.length > activeLimit && <Button className="mt-4" onClick={() => setActiveLimit(n => n + 6)}>Load More</Button>}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-brand-indigo">Completed Orders</h2>
          <span className="text-sm text-slate-500">{completed.length}</span>
        </div>
        {completed.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><CalendarClock className="h-4 w-4" /> Delivered orders will be kept here for your records.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{completed.slice(0, completedLimit).map((o) => <OrderCard key={o.id} o={o} readOnly={readOnly} {...(onOrder ? { onOrder } : {})} {...(sharePath ? { sharePath } : {})} />)}</div>
        )}
        {completed.length > completedLimit && <Button className="mt-4" onClick={() => setCompletedLimit(n => n + 6)}>Load More</Button>}
      </section>
    </>
  );
}
