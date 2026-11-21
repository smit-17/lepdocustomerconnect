import { NavLink, Outlet, Link } from '@/lepdo/router';
import { LogOut } from 'lucide-react';
import { Avatar, Button, Logo, cx } from '../components/ui';
import { useAuth } from '../lib/auth';
import { usePortalHome } from '../lib/api';

const NAV = [
  { to: '/portal', label: 'My Orders', end: true },
  { to: '/portal/profile', label: 'My Profile' },
  { to: '/portal/terms', label: 'Terms & Conditions' },
];

export default function PortalLayout() {
  const { signOut } = useAuth();
  const { data } = usePortalHome();
  const exec = data?.executive;

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-30 border-b border-cream-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/portal" className="flex items-center gap-3">
            <Logo className="h-6 sm:h-7" />
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-orange sm:inline">Connect</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            {exec && (
              <Link to="/portal/executive" className="flex items-center gap-2 rounded-full border border-cream-200 py-1 pl-1 pr-3 text-left transition hover:border-brand-orange/40">
                <Avatar name={exec.full_name} url={exec.photo_url} size="sm" />
                <span className="hidden leading-tight sm:block">
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500">Your executive</span>
                  <span className="block text-xs font-semibold text-brand-indigo">{exec.full_name}</span>
                  {exec.job_title && <span className="block text-[10px] text-muted-foreground">{exec.job_title}</span>}
                </span>
                <span className="text-xs font-semibold text-brand-indigo sm:hidden">Contact</span>
              </Link>
            )}
             <Button variant="ghost" onClick={signOut} className="p-2" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
             </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 sm:px-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition',
                  isActive ? 'border-brand-orange text-brand-indigo' : 'border-transparent text-slate-500 hover:text-brand-indigo')
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-slate-400 sm:px-6">
        {data?.company.company_name || 'LEPDO'} · {data?.company.tagline || 'B2B Diamonds & Jewellery'}
      </footer>
    </div>
  );
}
