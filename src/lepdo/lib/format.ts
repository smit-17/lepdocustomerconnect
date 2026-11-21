export function money(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = value.length === 10 ? new Date(value + 'T00:00:00') : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return fmtDate(value);
}

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string | null | undefined): string {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function waLink(number: string | null | undefined, text?: string): string | null {
  const digits = (number || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Turns Supabase/Postgres errors into short, human messages. */
export function errorMessage(err: unknown): string {
  const e = err as { message?: string; code?: string; details?: string } | null;
  const msg = e?.message || String(err ?? 'Something went wrong');
  if (e?.code === '23505' || /duplicate key/i.test(msg)) {
    if (/customers_email/i.test(msg)) return 'A customer with this email already exists.';
    return 'This record already exists.';
  }
  if (/row-level security|permission denied/i.test(msg)) return 'You do not have permission to do this.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Network error — please check your connection and try again.';
  if (/violates check constraint/i.test(msg)) return 'Please check the values entered — one of them is not valid.';
  return msg;
}

export function cleanSearch(q: string): string {
  return q.replace(/[,()%*\\]/g, ' ').trim();
}
