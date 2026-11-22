import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { RotateCcw } from 'lucide-react';
import { Button, Drawer, Field, Input } from './ui';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth';
import { deleteOrderHistory } from '../lib/history.functions';
import { errorMessage } from '../lib/format';

export default function ResetHistoryButton() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = useServerFn(deleteOrderHistory);
  const qc = useQueryClient();
  const toast = useToast();
  const close = () => { if (!busy) { setOpen(false); setConfirmation(''); } };
  if (!isAdmin) return null;
  return <>
    <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setOpen(true)}>Reset History</Button>
    <Drawer open={open} onClose={close} title="Reset History" footer={<>
      <Button variant="ghost" disabled={busy} onClick={close}>Cancel</Button>
      <Button variant="danger" loading={busy} disabled={confirmation !== 'RESET HISTORY'} onClick={async () => {
        if (confirmation !== 'RESET HISTORY') return;
        setBusy(true);
        try {
          const result = await reset({ data: { kind: 'reset', confirmation: 'RESET HISTORY' } });
          setOpen(false); setConfirmation('');
          await qc.invalidateQueries();
          toast.success(`History reset — ${result.deletedCount} orders deleted`);
          if (result.cleanupPending) toast.error('History cleared, but some stored files could not be removed.');
        } catch (err) { toast.error(errorMessage(err)); }
        finally { setBusy(false); }
      }}>Reset History</Button>
    </>}>
      <p className="mb-4 text-sm text-muted-foreground">Permanently delete all orders, payments, invoices, approvals, shipments and order history. Customers, KYC, consent, accounts and settings will be kept. This cannot be undone.</p>
      <Field label="Type RESET HISTORY to confirm"><Input value={confirmation} disabled={busy} autoComplete="off" onChange={(e) => setConfirmation(e.target.value)} /></Field>
    </Drawer>
  </>;
}