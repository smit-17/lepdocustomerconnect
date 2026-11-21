import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from '@/lepdo/router';
import { useQueryClient } from '@tanstack/react-query';
import { Gem, Sparkles } from 'lucide-react';
import { Button, Drawer, Field, Input, Select, Textarea, cx } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { uploadDocument, useCustomers, useSettings, useStaff } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/format';
import { CURRENCIES } from '../../lib/workflows';
import type { OrderType } from '../../lib/types';

export default function NewOrderDrawer({ open, onClose, customerId }: { open: boolean; onClose: () => void; customerId?: string }) {
  const customers = useCustomers('');
  const staff = useStaff();
  const settings = useSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [cid, setCid] = useState('');
  const [type, setType] = useState<OrderType>('diamond');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [execOverride, setExecOverride] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [po, setPo] = useState('');
  const [eta, setEta] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCid(customerId || ''); setType('diamond'); setTitle(''); setAmount(''); setExecOverride('');
    setCurrency(settings.data?.default_currency || 'USD'); setShowMore(false); setPo(''); setEta(''); setNotes(''); setFile(null); setError(null);
  }, [open, customerId, settings.data?.default_currency]);

  const customer = useMemo(() => customers.data?.find((c) => c.id === cid), [customers.data, cid]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!cid) return setError('Select a customer.');
    if (!title.trim()) return setError('Add an order title or reference.');
    const amt = amount.trim() ? Number(amount.replace(/,/g, '')) : null;
    if (amt !== null && (Number.isNaN(amt) || amt < 0)) return setError('Order amount must be a positive number.');
    setBusy(true);
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: cid,
        order_type: type,
        title: title.trim(),
        currency,
        proforma_amount: amt,
        executive_override_id: execOverride && execOverride !== customer?.assigned_executive_id ? execOverride : null,
        customer_po_ref: po.trim() || null,
        expected_delivery_date: eta || null,
        notes: notes.trim() || null,
      })
      .select('id, reference')
      .single();
    if (error) {
      setBusy(false);
      return setError(errorMessage(error));
    }
    if (file) {
      try {
        await uploadDocument(data.id, file, { doc_type: 'proforma_invoice', customer_visible: true, name: `Proforma Invoice ${data.reference}` });
      } catch (err) {
        toast.error(`Order created, but the proforma upload failed: ${errorMessage(err)}`);
      }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['customers'] });
    qc.invalidateQueries({ queryKey: ['customer'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success(`Order ${data.reference} created`);
    onClose();
    navigate(`/admin/orders/${data.id}`);
  }

  const execName = staff.data?.find((s) => s.id === (execOverride || customer?.assigned_executive_id))?.full_name;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New order"
      subtitle="The order reference is generated automatically."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="order-form" loading={busy}>Create order</Button>
      </>}
    >
      <form id="order-form" onSubmit={save} className="space-y-4">
        <Field label="Customer" required>
          <Select value={cid} onChange={(e) => { setCid(e.target.value); setExecOverride(''); }} autoFocus={!customerId}>
            <option value="">Select customer…</option>
            {(customers.data || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.country}</option>
            ))}
          </Select>
        </Field>

        <Field label="Order type" required group>
          <div className="grid grid-cols-2 gap-2">
            {([['diamond', 'Diamond', Gem], ['jewellery', 'Jewellery', Sparkles]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                className={cx('flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition',
                  type === v ? 'border-brand-indigo bg-cream-100 text-brand-indigo ring-1 ring-brand-indigo' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Order title or reference" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'diamond' ? 'e.g. 2.01ct Oval E VS1 IGI' : 'e.g. Halo engagement ring 18K'} maxLength={200} autoFocus={!!customerId} />
        </Field>

        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Order amount" hint="Optional — add later if not known.">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Assigned executive" hint={customer ? 'Inherited from the customer. Change only for this order if needed.' : undefined}>
          <Select value={execOverride || customer?.assigned_executive_id || ''} onChange={(e) => setExecOverride(e.target.value)} disabled={!customer}>
            {!customer && <option value="">Select a customer first</option>}
            {(staff.data || []).filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}{s.id === customer?.assigned_executive_id ? ' (customer default)' : ''}</option>)}
          </Select>
        </Field>
        {customer && !execName && <p className="-mt-2 text-xs text-slate-500">Executive: {customer.executive_name}</p>}

        {!showMore ? (
          <button type="button" className="text-sm font-medium text-brand-indigo hover:underline" onClick={() => setShowMore(true)}>
            + Add PO reference, delivery date, notes or proforma
          </button>
        ) : (
          <div className="space-y-4 rounded-xl bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Customer PO reference"><Input value={po} onChange={(e) => setPo(e.target.value)} maxLength={100} /></Field>
              <Field label="Expected delivery"><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></Field>
            </div>
            <Field label="Short order notes" hint="Internal — not shown to the customer."><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} /></Field>
            <Field label="Proforma invoice" hint="PDF or image. Visible to the customer.">
              <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-indigo file:shadow-card" />
            </Field>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Drawer>
  );
}
