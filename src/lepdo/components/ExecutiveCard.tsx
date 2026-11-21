import { Mail, MessageCircle, Phone } from 'lucide-react';
import { Avatar, cx } from './ui';
import { waLink } from '../lib/format';
import type { Executive } from '../lib/types';

export function ExecutiveCard({ exec, orderRef, compact }: { exec: Executive | null; orderRef?: string; compact?: boolean }) {
  if (!exec) return null;
  const subject = orderRef ? `Order ${orderRef}` : 'My LEPDO orders';
  const wa = waLink(exec.whatsapp || exec.phone, orderRef ? `Hello ${exec.full_name.split(' ')[0]}, regarding order ${orderRef}: ` : undefined);
  return (
    <div className={cx('rounded-2xl border border-cream-200 bg-white', compact ? 'p-4' : 'p-5 sm:p-6')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Your LEPDO executive</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={exec.full_name} url={exec.photo_url} size={compact ? 'md' : 'lg'} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-brand-indigo">{exec.full_name}</p>
          {exec.job_title && <p className="truncate text-sm text-slate-500">{exec.job_title}</p>}
        </div>
      </div>
      <div className={cx('mt-4 grid gap-2', wa ? 'grid-cols-2' : 'grid-cols-1')}>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-3 text-sm font-semibold text-brand-ink transition hover:brightness-95">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        <a href={`mailto:${exec.email}?subject=${encodeURIComponent(subject)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-brand-indigo transition hover:bg-cream-50">
          <Mail className="h-4 w-4" /> Email
        </a>
      </div>
      {!compact && (
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /><a href={`mailto:${exec.email}`} className="truncate hover:text-brand-indigo">{exec.email}</a></div>
          {exec.phone && <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" /><a href={`tel:${exec.phone.replace(/[^\d+]/g, '')}`} className="hover:text-brand-indigo">{exec.phone}</a></div>}
          {exec.whatsapp && exec.whatsapp !== exec.phone && <div className="flex items-center gap-2 text-slate-600"><MessageCircle className="h-4 w-4 text-slate-400" />{exec.whatsapp}</div>}
        </dl>
      )}
    </div>
  );
}
