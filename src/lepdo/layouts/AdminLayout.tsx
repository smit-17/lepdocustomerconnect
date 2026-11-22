import { createContext, useContext, useState } from 'react';
import { NavLink, Outlet, useLocation } from '@/lepdo/router';
import { LayoutDashboard, LogOut, Menu, Package, Settings, Users, X } from 'lucide-react';
import { Avatar, Logo, cx } from '../components/ui';
import { useAuth } from '../lib/auth';
import NewOrderDrawer from '../pages/admin/NewOrderDrawer';
import CustomerDrawer from '../pages/admin/CustomerDrawer';

interface QuickActions {
  newOrder: (customerId?: string) => void;
  newCustomer: () => void;
}
const QuickCtx = createContext<QuickActions>({ newOrder: () => {}, newCustomer: () => {} });
export const useQuickActions = () => useContext(QuickCtx);

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/orders', label: 'Orders', icon: Package },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orderFor, setOrderFor] = useState<string | null | undefined>(undefined); // undefined = closed
  const [customerOpen, setCustomerOpen] = useState(false);
  const location = useLocation();

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-cream-200 text-brand-indigo' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-indigo')
          }
        >
          <n.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  const userBox = (
    <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
      <Avatar name={profile?.full_name || profile?.email} url={profile?.photo_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{profile?.full_name || profile?.email}</p>
        <p className="text-xs capitalize text-slate-500">{profile?.role === 'team' ? 'Team member' : profile?.role}</p>
      </div>
      <button onClick={signOut} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-indigo" title="Sign out" aria-label="Sign out">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <QuickCtx.Provider value={{ newOrder: (id) => setOrderFor(id ?? null), newCustomer: () => setCustomerOpen(true) }}>
      <div className="min-h-screen bg-[#FAFAF9]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200/80 bg-white px-4 py-5 lg:flex">
          <div className="mb-8 px-2">
            <Logo className="h-7" variant="brand" />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Connect</p>
          </div>
          <div className="flex-1">{nav}</div>
          {userBox}
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <Logo className="h-6" variant="brand" />
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-brand-indigo hover:bg-slate-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </header>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white px-4 py-5 shadow-pop">
              <div className="mb-6 flex items-center justify-between px-2">
                <Logo className="h-6" variant="brand" />
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-500" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1">{nav}</div>
              {userBox}
            </div>
          </div>
        )}

        <main className="lg:pl-60">
          <div key={location.pathname} className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>

        <NewOrderDrawer open={orderFor !== undefined} customerId={orderFor ?? undefined} onClose={() => setOrderFor(undefined)} />
        <CustomerDrawer
          open={customerOpen}
          onClose={() => setCustomerOpen(false)}
          onCreateOrder={(id) => { setCustomerOpen(false); setOrderFor(id); }}
        />
      </div>
    </QuickCtx.Provider>
  );
}
