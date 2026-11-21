import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@/lepdo/router';
import { ArrowUpRight, ClipboardList, Package, Plus, UserRound } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { StageCell, TypeLabel } from '../../components/OrderBits';
import { keys, run } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { PAYMENT_STAGE_KEYS } from '../../lib/workflows';
import type { OrderListRow } from '../../lib/types';
import { useQuickActions } from '../../layouts/AdminLayout';

async function count(table: string, apply: (q: any) => any) {
  const { count, error } = await apply(supabase.from(table).select('id', { count: 'exact', head: true }));
  if (error) throw error;
  return count ?? 0;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const quick = useQuickActions();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: keys.dashboard,
    queryFn: async () => {
      const [customers, active, awaiting, ready, completed, attention, recent, pendingPayment, cad, qc] = await Promise.all([
        count('customers', (q) => q),
        count('orders', (q) => q.eq('status', 'active')),
        count('orders', (q) => q.eq('status', 'active').in('current_stage_key', PAYMENT_STAGE_KEYS)),
        count('orders', (q) => q.eq('status', 'active').eq('current_stage_key', 'ready_to_ship')),
        count('orders', (q) => q.eq('status', 'completed')),
        run<OrderListRow[]>(supabase.from('order_list').select('*').eq('status', 'active').not('next_action', 'is', null).order('updated_at', { ascending: true }).limit(25)),
        run<OrderListRow[]>(supabase.from('order_list').select('*').order('updated_at', { ascending: false }).limit(8)),
        run<string[]>(supabase.rpc('staff_pending_payment_orders')),
        count('orders', q => q.eq('status', 'active').eq('current_stage_key', 'cad_approval')),
        count('orders', q => q.eq('status', 'active').eq('current_stage_key', 'quality_check')),
      ]);
      return { customers, active, awaiting, ready, completed, attention, recent, pendingPayment, cad, qc };
    },
    refetchOnWindowFocus: true,
  });

  const kpis = [
    { label: 'Total Customers', value: data?.customers, to: '/admin/customers' },
    { label: 'Active Orders', value: data?.active, to: '/admin/orders' },
    { label: 'Awaiting Payment', value: data?.awaiting, to: '/admin/orders' },
    { label: 'Ready to Ship', value: data?.ready, to: '/admin/orders' },
    { label: 'Completed Orders', value: data?.completed, to: '/admin/orders?tab=completed' },
  ];

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle="Here is what needs attention today."
        actions={<>
          <Button icon={<UserRound className="h-4 w-4" />} onClick={quick.newCustomer}>New Customer</Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => quick.newOrder()}>New Order</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="group rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-card transition hover:border-brand-indigo/30">
            <p className="text-xs font-medium text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-indigo">{isLoading ? <Spinner className="h-5 w-5" /> : k.value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-6 border-y border-cream-200 py-5">
        <h2 className="mb-3 font-semibold text-brand-indigo">Needs Attention</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[{ key: 'payment', label: 'Payment Verification Required', count: data?.pendingPayment.length }, { key: 'cad', label: 'CAD Approval Pending', count: data?.cad }, { key: 'qc', label: 'QC Pending', count: data?.qc }, { key: 'dispatch', label: 'Ready to Dispatch', count: data?.ready }].map(item => <Button key={item.key} className="h-auto min-h-20 flex-col whitespace-normal text-center" onClick={() => navigate(`/admin/orders?attention=${item.key}`)}><span className="text-xl font-semibold">{item.count ?? '—'}</span><span className="text-xs">{item.label}</span></Button>)}
        </div>
      </section>
      <Card className="mt-6" title={<span className="flex items-center gap-2">Orders Requiring Attention {data && data.attention.length > 0 && <span className="rounded-full bg-brand-orange px-2 py-0.5 text-xs font-semibold text-brand-ink">{data.attention.length}</span>}</span>} bodyClass="p-0">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !data?.attention.length ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing needs attention right now." text="Orders that need payment follow-up, approvals, dispatch or tracking will appear here." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead><tr><th>Order ID</th><th>Customer</th><th>Type</th><th>Current Status</th><th>Next Action</th><th /></tr></thead>
                <tbody>
                  {data.attention.map((o) => (
                    <tr key={o.id} className="row-link" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                      <td className="font-medium text-brand-indigo">{o.reference}</td>
                      <td>{o.customer_name}</td>
                      <td><TypeLabel type={o.order_type} /></td>
                      <td><StageCell name={o.current_stage_name} status={o.current_stage_status} /></td>
                      <td><span className="font-medium text-orange-700">{o.next_action}</span></td>
                      <td className="text-right"><ArrowUpRight className="inline h-4 w-4 text-slate-400" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.attention.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className="block px-4 py-3">
                    <div className="flex items-center justify-between"><span className="font-medium text-brand-indigo">{o.reference}</span><span className="text-xs text-slate-500">{o.customer_name}</span></div>
                    <div className="mt-1 text-sm text-slate-600">{o.current_stage_name}</div>
                    <div className="mt-1 text-sm font-medium text-orange-700">{o.next_action}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="mt-6" title="Recently Updated" action={<Link to="/admin/orders" className="text-sm font-medium text-brand-indigo hover:underline">All orders</Link>} bodyClass="p-0">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !data?.recent.length ? (
          <EmptyState icon={<Package className="h-5 w-5" />} title="No orders yet." text="Create your first order." action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => quick.newOrder()}>New Order</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recent.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="flex flex-col gap-1 px-4 py-3 transition hover:bg-cream-50 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <span className="w-32 shrink-0 font-medium text-brand-indigo">{o.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{o.customer_name} · <span className="text-slate-500">{o.title}</span></span>
                  <span className="text-sm"><StageCell name={o.current_stage_name} status={o.current_stage_status} orderStatus={o.status} /></span>
                  <span className="w-24 shrink-0 text-xs text-slate-500 sm:text-right">{timeAgo(o.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
