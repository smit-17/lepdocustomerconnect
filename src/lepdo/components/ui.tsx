import { forwardRef, useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import type { Tone } from '../lib/workflows';
import { initials } from '../lib/format';
import logoBlack from '@/assets/lepdo-logo-black.png.asset.json';
import logoWhite from '@/assets/lepdo-logo-white.png.asset.json';
import logoBrand from '@/assets/lepdo-logo-brand.png.asset.json';
import logo from '@/assets/logo.png';
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Logo */
export function Logo({ className = 'h-6', variant = 'black' }: { className?: string; variant?: 'black' | 'white' | 'brand' }) {
  // 'brand' = new colour logo for app dashboards; 'black'/'white' = original master artwork (sign-in screens).
  const src = variant === 'white' ? logo : variant === 'brand' ? logo : logo;
  return <img src={src} alt="LEPDO" className={cx('w-auto max-w-none shrink-0 self-start object-contain select-none', className)} draggable={false} />;
}

/* ---------------------------------------------------------------- Button */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'indigo';
type BtnSize = 'sm' | 'md' | 'lg';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
}
const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-brand-orange text-brand-ink hover:brightness-95 active:brightness-90 font-semibold',
  indigo: 'bg-brand-indigo text-white hover:bg-[#1d2290] font-semibold',
  secondary: 'bg-white text-brand-indigo border border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-medium',
  ghost: 'text-brand-indigo hover:bg-cream-100 font-medium',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 font-medium',
};
const btnSize: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 disabled:cursor-not-allowed disabled:opacity-60',
        btnVariant[variant], btnSize[size], className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ----------------------------------------------------------------- Forms */
export function Field({ label, hint, error, children, className, group }: { label: string; required?: boolean; hint?: string; error?: string | null; children: ReactNode; className?: string; group?: boolean }) {
  // `group` renders a fieldset-like <div role="group"> for button groups / checkbox lists,
  // so the label does not hijack the accessible name of the first control.
  const Tag = (group ? 'div' : 'label') as 'label';
  const labelId = useId();
  return (
    <Tag className={cx('block', className)} {...(group ? { role: 'group', 'aria-labelledby': labelId } : {})}>
      <span id={labelId} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </Tag>
  );
}

const inputBase = 'w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/15 disabled:bg-slate-50 disabled:text-slate-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, 'h-10', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-[80px] py-2', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(inputBase, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand-indigo' : 'bg-slate-300')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </label>
    </div>
  );
}

/* --------------------------------------------------------------- Surfaces */
export function Card({ children, className, title, action, bodyClass }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; bodyClass?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-200/80 bg-white shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-[15px] font-semibold text-brand-indigo">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx('p-4 sm:p-5', bodyClass)}>{children}</div>
    </section>
  );
}

const toneClass: Record<Tone, string> = {
  grey: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  indigo: 'bg-indigo-50 text-brand-indigo ring-brand-indigo/15',
  orange: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  cream: 'bg-cream-200 text-brand-indigo',
};
export function Badge({ tone = 'grey', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent', toneClass[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx('h-5 w-5 animate-spin text-brand-indigo', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-cream-100 p-3 text-brand-indigo">{icon}</div>}
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = (error as { message?: string })?.message || String(error);
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>;
}

export function Avatar({ name, url, size = 'md' }: { name?: string | null; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  if (url) return <img src={url} alt={name || ''} className={cx('shrink-0 rounded-full object-cover', s)} />;
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-cream-200 font-semibold text-brand-indigo', s)}>{initials(name)}</span>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-indigo transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ------------------------------------------------------- Drawer / Modal */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('relative flex h-full w-full flex-col bg-white shadow-pop', wide ? 'sm:max-w-xl' : 'sm:max-w-md')}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-brand-indigo">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'orange' | 'green' }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cx('mt-1 text-lg font-semibold tabular-nums sm:text-xl', tone === 'orange' ? 'text-orange-700' : tone === 'green' ? 'text-emerald-700' : 'text-brand-indigo')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-brand-indigo sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium transition', value === it.value ? 'border-brand-orange text-brand-indigo' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          {it.label}
          {it.count !== undefined && <span className={cx('ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]', value === it.value ? 'bg-cream-200 text-brand-indigo' : 'bg-slate-100 text-slate-500')}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
