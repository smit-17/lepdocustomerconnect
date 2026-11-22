import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Trash2 } from 'lucide-react';
import { Button } from './ui';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth';
import { deleteOrderHistory } from '../lib/history.functions';
import { errorMessage } from '../lib/format';

export default function DeleteOrderButton({ orderId, reference, locked, onDeleted }: { orderId: string; reference: string; locked: boolean; onDeleted?: () => void }) {
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const remove = useServerFn(deleteOrderHistory);
  const qc = useQueryClient();
  const toast = useToast();
  if (!isAdmin || locked) return null;
  return <Button variant="danger" size="sm" className="w-8 px-0" title="Delete order" aria-label={`Delete order ${reference}`} loading={busy} icon={<Trash2 className="h-4 w-4" />} onClick={async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Permanently delete order ${reference} and its payments, files and history? Customer records will be kept. This cannot be undone.`)) return;
    setBusy(true);
    try {
      const result = await remove({ data: { kind: 'order', orderId } });
      onDeleted?.();
      await qc.invalidateQueries();
      toast.success('Order deleted');
      if (result.cleanupPending) toast.error('Order deleted, but some stored files could not be removed.');
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  }} />;
}