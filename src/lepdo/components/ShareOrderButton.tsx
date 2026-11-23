import { useState } from 'react';
import { Copy, Share2, Link2Off } from 'lucide-react';
import { Button, Drawer, Input } from './ui';
import { useToast } from './Toast';
import { run } from '../lib/api';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/format';
import { customerTrackingUrl } from '../lib/tracking';

export default function ShareOrderButton({ orderId }: { orderId: string }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function share() {
    setBusy(true);
    try {
      const token = await run<string>(supabase.rpc('staff_share_order', { p_order_id: orderId }));
      setUrl(customerTrackingUrl(token));
      setOpen(true);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <>
    <Button icon={<Share2 className="h-4 w-4" />} loading={busy} onClick={share}>Share Order Status</Button>
    <Drawer open={open} onClose={() => setOpen(false)} title="Share Order Status">
      <Input aria-label="Customer tracking link" value={url} readOnly onFocus={e => e.target.select()} />
      <Button className="mt-3" icon={<Copy className="h-4 w-4" />} onClick={async () => {
        try { await navigator.clipboard.writeText(url); toast.success('Tracking link copied'); }
        catch { toast.error('Select the link to copy it.'); }
      }}>Copy link</Button>
      <Button className="ml-3 mt-3" loading={busy} icon={<Link2Off className="h-4 w-4" />} onClick={async () => {
        if (!window.confirm('Revoke this shared customer link? Anyone with this link will lose access.')) return;
        setBusy(true);
        try {
          await run(supabase.rpc('staff_revoke_order_share', { p_order_id: orderId }));
          setUrl(''); setOpen(false); toast.success('Shared link revoked');
        } catch (error) { toast.error(errorMessage(error)); }
        finally { setBusy(false); }
      }}>Revoke link</Button>
    </Drawer>
  </>;
}