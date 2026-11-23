import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from '../../router';
import { PageLoader, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { run } from '../../lib/api';
import { TRACKING_REFRESH_MS, trackingToken } from '../../lib/tracking';
import { sharedCustomer, sharedHome, sharedOrderView } from '../../lib/shared-profile';
import { PortalLayoutView } from '../../layouts/PortalLayout';
import { PortalHomeView } from './PortalHomePage';
import { CustomerProfileDetails } from './PortalProfilePage';
import { OrderView } from './PortalOrderPage';

export default function SharedOrderPage() {
  const { token = '' } = useParams();
  const valid = trackingToken.safeParse(token).success;
  const [tab, setTab] = useState('My Profile');
  const [orderId, setOrderId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['shared-order', token],
    enabled: valid,
    queryFn: async () => {
      const result = await run<unknown>(supabase.rpc('public_shared_customer', { p_token: token }));
      return result === null ? null : sharedCustomer.parse(result);
    },
    refetchInterval: TRACKING_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const data = valid && !query.isError ? query.data : null;
  const home = data ? sharedHome(data) : undefined;
  const order = data?.orders.find(o => o.id === orderId);
  const path = `/portal-share/${token}`;
  return <PortalLayoutView data={home} shared={{ path, tab, onTab: next => { setTab(next); setOrderId(null); } }}>
    {valid && query.isPending ? <PageLoader /> : !data || !home ?
      <EmptyState title="Tracking link unavailable" text="This link is invalid, revoked or temporarily unavailable." /> : order ?
      <OrderView key={order.id} d={sharedOrderView(order)} readOnly sharePath={path} onBack={() => { setOrderId(null); setTab('My Orders'); }} /> : <>
        {tab === 'My Profile' && <>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-indigo">My Profile</h1>
          <div className="mb-8 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"><CustomerProfileDetails data={home} readOnly /></div>
        </>}
        <PortalHomeView data={home} readOnly sharePath={path} onOrder={setOrderId} />
      </>}
  </PortalLayoutView>;
}