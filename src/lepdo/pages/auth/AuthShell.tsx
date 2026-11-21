import type { ReactNode } from 'react';
import { Logo } from '../../components/ui';
import { isDemoMode } from '../../lib/supabase';

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-cream-200 p-12 lg:flex">
        <Logo className="h-9" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-orange">LEPDO CONNECT</p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight tracking-tight text-brand-indigo">Every Order. Every Step. Connected.</h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-brand-indigo/80">
            Order progress, payments, documents and shipment tracking for LEPDO trade partners — in one place.
          </p>
        </div>
        <p className="text-xs text-brand-indigo/70">B2B Diamonds &amp; Jewellery</p>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo className="h-8" />
            <p className="mt-3 text-sm text-slate-500">Every Order. Every Step. Connected.</p>
          </div>
          {isDemoMode && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Demo environment.</strong> Contains demonstration data only. See README for demo logins.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
