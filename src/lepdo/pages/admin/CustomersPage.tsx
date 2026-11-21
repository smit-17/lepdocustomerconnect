import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@/lepdo/router';
import { ChevronRight, Plus, Search, Users } from 'lucide-react';
import { Button, Card, EmptyState, ErrorNote, Input, PageHeader, Spinner } from '../../components/ui';
import { useCustomers } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useQuickActions } from '../../layouts/AdminLayout';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, isFetching, error } = useCustomers(debounced);
  const quick = useQuickActions();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Customers" actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={quick.newCustomer}>Add Customer</Button>} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email or phone" className="pl-9" aria-label="Search customers" />
        {isFetching && !isLoading && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
      </div>
      <ErrorNote error={error} />

      <Card bodyClass="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data?.length ? (
          debounced ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="No customers match your search." />
          ) : (
            <EmptyState icon={<Users className="h-5 w-5" />} title="No customers yet." text="Add your first customer — it takes less than 30 seconds." action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={quick.newCustomer}>Add Customer</Button>} />
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead>
                  <tr><th>Customer / Company Name</th><th>Country</th><th>Assigned Executive</th><th className="text-center">Active Orders</th><th>Last Activity</th><th className="text-right">Action</th></tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id} className="row-link" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                      <td>
                        <p className="font-medium text-brand-indigo">{c.name}</p>
                        {c.contact_person && <p className="text-xs text-slate-500">{c.contact_person}</p>}
                      </td>
                      <td className="text-slate-700">{c.country}</td>
                      <td className="text-slate-700">{c.executive_name || '—'}</td>
                      <td className="text-center tabular-nums">{c.active_orders > 0 ? <span className="font-semibold text-brand-indigo">{c.active_orders}</span> : <span className="text-slate-400">0</span>}</td>
                      <td className="text-slate-500">{timeAgo(c.last_activity)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => quick.newOrder(c.id)}>Order</Button>
                        <Link to={`/admin/customers/${c.id}`} className="ml-1 inline-flex h-8 items-center rounded-lg px-2 text-sm font-medium text-brand-indigo hover:bg-cream-100">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-brand-indigo">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.country} · {c.executive_name} · {c.active_orders} active</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
