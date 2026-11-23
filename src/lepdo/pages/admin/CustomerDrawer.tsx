import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from '@/lepdo/router';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Package, Send } from 'lucide-react';
import { Button, Drawer, Field, Input, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { sendInvite, useStaff } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/format';
import { COUNTRIES } from '../../lib/workflows';
import type { Customer } from '../../lib/types';

const empty = { name: '', email: '', country: '', assigned_executive_id: '', contact_person: '', phone: '', address: '', internal_notes: '' };

export default function CustomerDrawer({ open, onClose, onCreateOrder, customer }: { open: boolean; onClose: () => void; onCreateOrder?: (customerId: string) => void; customer?: Customer }) {
  const { profile } = useAuth();
  const staff = useStaff();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; email: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    setInvited(false);
    setForm(customer
      ? { name: customer.name, email: customer.email, country: customer.country, assigned_executive_id: customer.assigned_executive_id, contact_person: customer.contact_person || '', phone: customer.phone || '', address: customer.address || '', internal_notes: customer.internal_notes || '' }
      : { ...empty, assigned_executive_id: profile?.id || '' });
  }, [open, customer, profile?.id]);

  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      country: form.country.trim(),
      assigned_executive_id: form.assigned_executive_id || profile?.id,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      internal_notes: form.internal_notes.trim() || null,
    };
    const res = customer
      ? await supabase.from('customers').update(payload).eq('id', customer.id).select('id, name, email').single()
      : await supabase.from('customers').insert(payload).select('id, name, email').single();
    setBusy(false);
    if (res.error) return setError(errorMessage(res.error));
    qc.invalidateQueries({ queryKey: ['customers'] });
    qc.invalidateQueries({ queryKey: ['customer'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    if (customer) {
      toast.success('Customer updated');
      onClose();
    } else {
      toast.success('Customer created');
      setCreated(res.data);
    }
  }

  async function invite() {
    if (!created) return;
    setInviting(true);
    try {
      await sendInvite({ kind: 'customer', customer_id: created.id });
      setInvited(true);
      toast.success(`Invitation sent to ${created.email}`);
      qc.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  if (created) {
    return (
      <Drawer open={open} onClose={onClose} title="Customer created">
        <div className="flex flex-col items-center py-6 text-center">
          <CircleCheck className="h-12 w-12 text-emerald-600" strokeWidth={1.5} />
          <p className="mt-3 text-lg font-semibold text-brand-indigo">{created.name}</p>
          <p className="text-sm text-slate-500">{created.email}</p>
        </div>
        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" icon={<Package className="h-4 w-4" />} onClick={() => onCreateOrder?.(created.id)}>
            Create Order
          </Button>
          <Button size="lg" className="w-full" icon={<Send className="h-4 w-4" />} loading={inviting} disabled={invited || !created.email} onClick={invite}>
            {invited ? 'Invitation sent' : 'Send Customer Invitation'}
          </Button>
          <button className="w-full py-2 text-sm text-slate-500 hover:text-brand-indigo" onClick={() => { onClose(); navigate(`/admin/customers/${created.id}`); }}>
            Open customer page
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'Add customer'}
      
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="customer-form" loading={busy}>{customer ? 'Save changes' : 'Create customer'}</Button>
      </>}
    >
      <form id="customer-form" onSubmit={save} className="space-y-4">
        <Field label="Customer or company name">
          <Input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Aurora Fine Jewels Ltd" maxLength={200} />
        </Field>
        <Field label="Email address" hint="Used for the customer portal invitation.">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="buyer@company.com" maxLength={200} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Input list="country-list" value={form.country} onChange={set('country')} placeholder="Start typing…" maxLength={80} />
            <datalist id="country-list">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Assigned executive">
            <Select value={form.assigned_executive_id} onChange={set('assigned_executive_id')}>
              <option value="">Select…</option>
              {(staff.data || []).filter((s) => s.is_active || s.id === form.assigned_executive_id).map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="pt-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Optional</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Contact person"><Input value={form.contact_person} onChange={set('contact_person')} maxLength={120} /></Field>
              <Field label="Phone / WhatsApp"><Input type="tel" value={form.phone} onChange={set('phone')} placeholder="+44 …" maxLength={50} /></Field>
            </div>
            <Field label="Company address"><Textarea rows={2} value={form.address} onChange={set('address')} maxLength={500} /></Field>
            <Field label="Internal notes" hint="Never shown to the customer."><Textarea rows={2} value={form.internal_notes} onChange={set('internal_notes')} maxLength={4000} /></Field>
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Drawer>
  );
}
