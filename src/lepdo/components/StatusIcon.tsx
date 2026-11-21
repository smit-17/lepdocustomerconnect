import { Check, Clock3, X, Minus } from 'lucide-react';
import type { StageStatus } from '../lib/types';
import { cx } from './ui';

/**
 * Timeline indicator:
 *  green check = completed · indigo clock = current · light grey = upcoming
 *  amber = recheck / approval required · red = blocked · dashed = not applicable
 */
export function StatusIcon({ status, current, size = 'md' }: { status: StageStatus; current?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7';
  const icon = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  if (status === 'completed')
    return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white', box)}><Check className={icon} strokeWidth={3} /></span>;
  if (status === 'attention')
    return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-amber font-bold text-brand-ink', box)}><span className={size === 'sm' ? 'text-[11px]' : 'text-sm'}>!</span></span>;
  if (status === 'blocked')
    return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-red-600 text-white', box)}><X className={icon} strokeWidth={3} /></span>;
  if (status === 'not_applicable')
    return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-slate-400', box)}><Minus className={icon} /></span>;
  if (status === 'in_progress' || current)
    return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-indigo text-white ring-4 ring-brand-indigo/10', box)}><Clock3 className={icon} strokeWidth={2.5} /></span>;
  return <span className={cx('inline-flex shrink-0 rounded-full border-2 border-slate-200 bg-slate-50', box)} />;
}
