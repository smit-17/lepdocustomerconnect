import { Gem, Sparkles } from 'lucide-react';
import { Badge } from './ui';
import { StatusIcon } from './StatusIcon';
import { ORDER_PAYMENT_STATUS } from '../lib/workflows';
import type { OrderPaymentStatus, OrderStatus, OrderType, StageStatus } from '../lib/types';

export function TypeLabel({ type }: { type: OrderType }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-700">
      {type === 'diamond' ? <Gem className="h-3.5 w-3.5 text-brand-blue" /> : <Sparkles className="h-3.5 w-3.5 text-brand-orange" />}
      {type === 'diamond' ? 'Diamond' : 'Jewellery'}
    </span>
  );
}

export function StageCell({ name, status, orderStatus }: { name: string | null; status: StageStatus | null; orderStatus?: OrderStatus }) {
  if (orderStatus === 'cancelled') return <Badge tone="red">Cancelled</Badge>;
  return (
    <span className="inline-flex items-center gap-2">
      <StatusIcon status={(status || 'upcoming') as StageStatus} current size="sm" />
      <span className="text-slate-800">{name || '—'}</span>
    </span>
  );
}

export function PaymentBadge({ status }: { status: OrderPaymentStatus }) {
  const m = ORDER_PAYMENT_STATUS[status] || ORDER_PAYMENT_STATUS.no_amount;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === 'completed') return <Badge tone="green">Completed</Badge>;
  if (status === 'cancelled') return <Badge tone="red">Cancelled</Badge>;
  return <Badge tone="indigo">Active</Badge>;
}

export function PortalStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'active': return <Badge tone="green">Portal active</Badge>;
    case 'invited': return <Badge tone="blue">Invited</Badge>;
    case 'disabled': return <Badge tone="red">Access disabled</Badge>;
    default: return <Badge tone="grey">Not invited</Badge>;
  }
}
