import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lepdo/router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Package, Plus, Search, X } from 'lucide-react';
import { Button, Card, EmptyState, ErrorNote, Input, PageHeader, Select, Spinner, Tabs } from '../../components/ui';
import { PaymentBadge, StageCell, TypeLabel } from '../../components/OrderBits';
import { useCustomers, useOrders, useStaff } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/format';
import { ALL_STAGES } from '../../lib/workflows';
import { useQuickActions } from '../../layouts/AdminLayout';
import DeleteOrderButton from '../../components/DeleteOrderButton';

type Tab = 'active' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const tab = (['active', 'completed', 'cancelled'].includes(params.get('tab') || '') ? params.get('tab') : 'active') as Tab;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('');
  const [stage, setStage] = useState('');
  const [executiveId, setExecutiveId] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const attention = params.get('attention') || '';
  const filters = { customerId, type, stage, executiveId, search: debounced, attention };
  const { data, isLoading, isFetching, error } = useOrders({ ...filters, status: tab });
  const customers = useCustomers('');
  const staff = useStaff();
  const quick = useQuickActions();
  const navigate = useNavigate();

  const counts = useQuery({
    queryKey: ['orders', 'counts'],
    queryFn: async () => {
      const r = await Promise.all((['active', 'completed', 'cancelled'] as const).map((s) => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', s)));
      return { active: r[0].count ?? 0, completed: r[1].count ?? 0, cancelled: r[2].count ?? 0 };
    },
  });

  const anyFilter = customerId || type || stage || executiveId || search || attention;

  return (
    <>
      <PageHeader title="Orders" actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => quick.newOrder()}>New Order</Button>} />

      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'active' ? {} : { tab: v }, { replace: true })}
        items={[
          { value: 'active', label: 'Active', count: counts.data?.active },
          { value: 'completed', label: 'Completed', count: counts.data?.completed },
          { value: 'cancelled', label: 'Cancelled', count: counts.data?.cancelled },
        ]}
      />

      <div className="my-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ID or customer" className="pl-9" aria-label="Search orders" />
          {isFetching && !isLoading && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
        </div>
        <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Customer">
          <option value="">All customers</option>
          {(customers.data || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Order type">
          <option value="">All types</option>
          <option value="diamond">Diamond</option>
          <option value="jewellery">Jewellery</option>
        </Select>
        <Select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Current stage">
          <option value="">All stages</option>
          {ALL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <Select value={executiveId} onChange={(e) => setExecutiveId(e.target.value)} aria-label="Assigned executive">
          <option value="">All executives</option>
          {(staff.data || []).map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
        </Select>
        {anyFilter ? (
          <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => { setSearch(''); setCustomerId(''); setType(''); setStage(''); setExecutiveId(''); setParams(tab === 'active' ? {} : { tab }); }}>Clear</Button>
        ) : <span className="hidden lg:block" />}
      </div>

      <ErrorNote error={error} />
      <Card bodyClass="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data?.length ? (
          anyFilter ? <EmptyState icon={<Search className="h-5 w-5" />} title="No orders match these filters." /> :
          tab === 'active' ? <EmptyState icon={<Package className="h-5 w-5" />} title="No active orders yet." text="Create your first order." action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => quick.newOrder()}>New Order</Button>} /> :
          <EmptyState icon={<Package className="h-5 w-5" />} title={`No ${tab} orders.`} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="table-base">
                <thead><tr><th>Order ID</th><th>Customer</th><th>Order Type</th><th>Current Stage</th><th>Payment Status</th><th>Last Updated</th><th>Assigned Executive</th><th className="text-right">Action</th></tr></thead>
                <tbody>
                  {data.map((o) => (
                    <tr key={o.id} className="row-link" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                      <td>
                        <p className="font-medium text-brand-indigo">{o.reference}</p>
                        <p className="max-w-[180px] truncate text-xs text-slate-500">{o.title}</p>
                      </td>
                      <td>{o.customer_name}</td>
                      <td><TypeLabel type={o.order_type} /></td>
                      <td>
                        <StageCell name={o.current_stage_name} status={o.current_stage_status} orderStatus={o.status} />
                        {o.status === 'active' && <div className="mt-1 h-1 w-28 overflow-hidden rounded bg-slate-100"><div className="h-full bg-brand-indigo" style={{ width: `${o.progress_pct}%` }} /></div>}
                      </td>
                      <td><PaymentBadge status={o.payment_status} /></td>
                      <td className="whitespace-nowrap text-slate-500">{timeAgo(o.updated_at)}</td>
                      <td className="text-slate-700">{o.executive_name || '—'}</td>
                       <td className="text-right"><div className="flex items-center justify-end gap-1"><Link to={`/admin/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex h-8 items-center rounded-lg px-2 text-sm font-medium text-brand-indigo hover:bg-cream-100">Open</Link><DeleteOrderButton enlarged orderId={o.id} reference={o.reference} locked={o.actions_locked !== false} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {data.map((o) => (
                 <li key={o.id} className="flex items-center">
                   <Link to={`/admin/orders/${o.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-brand-indigo">{o.reference}</span>
                        <PaymentBadge status={o.payment_status} />
                      </div>
                      <p className="truncate text-sm text-slate-700">{o.customer_name} · {o.order_type === 'diamond' ? 'Diamond' : 'Jewellery'}</p>
                      <div className="mt-1 text-sm"><StageCell name={o.current_stage_name} status={o.current_stage_status} orderStatus={o.status} /></div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                   <div className="pr-4"><DeleteOrderButton enlarged orderId={o.id} reference={o.reference} locked={o.actions_locked !== false} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
