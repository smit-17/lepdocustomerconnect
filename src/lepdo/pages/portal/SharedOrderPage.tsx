import { useQuery } from '@tanstack/react-query';
import { useParams } from '../../router';
import { Logo, PageLoader, ProgressBar, EmptyState } from '../../components/ui';
import { OrderStatusBadge } from '../../components/OrderBits';
import { StatusIcon } from '../../components/StatusIcon';
import { STAGE_STATUS } from '../../lib/workflows';
import { supabase } from '../../lib/supabase';
import { run } from '../../lib/api';
import { TRACKING_REFRESH_MS, trackingOrder, trackingToken } from '../../lib/tracking';

export default function SharedOrderPage() {
  const { token = '' } = useParams();
  const valid = trackingToken.safeParse(token).success;
  const query = useQuery({
    queryKey: ['shared-order', token],
    enabled: valid,
    queryFn: async () => {
      const result = await run<unknown>(supabase.rpc('public_track_order', { p_token: token }));
      return result === null ? null : trackingOrder.parse(result);
    },
    refetchInterval: TRACKING_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const order = query.data;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card px-5 py-5"><div className="mx-auto max-w-2xl"><Logo variant="brand" className="h-7" /></div></header>
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
      {valid && query.isPending ? <PageLoader /> : !order ?
        <EmptyState title="Tracking link unavailable" text="This link is invalid or the order is no longer available." /> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-sm text-muted-foreground">Order ID</p><h1 className="mt-1 break-all text-2xl font-semibold">{order.reference}</h1></div>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Current stage</p>
          <h2 className="mt-1 break-words text-lg font-semibold">{order.current_stage_name || 'Not started'}</h2>
          <div className="mb-2 mt-5 text-right text-sm text-muted-foreground">{Math.round(order.progress_pct)}%</div>
          <ProgressBar value={order.progress_pct} />
          <h2 className="mb-5 mt-10 text-lg font-semibold">Order progress</h2>
          <ol>{order.stages.map((stage, index) => <li key={stage.stage_key} className="relative flex gap-4 pb-7">
            {index < order.stages.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13px] top-7 w-px bg-border" />}
            <StatusIcon status={stage.status} />
            <div className="min-w-0"><p className="break-words font-medium">{stage.name}</p><p className="mt-1 text-sm text-muted-foreground">{STAGE_STATUS[stage.status].customerLabel}</p></div>
          </li>)}</ol>
          {query.isError && <p role="status" className="mt-4 text-sm text-muted-foreground">Updates are temporarily unavailable. Reconnecting…</p>}
        </>}
    </main>
  </div>;
}