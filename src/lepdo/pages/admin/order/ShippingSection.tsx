import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Pencil, Plus, Truck } from 'lucide-react';
import { Badge, Button, Card, Drawer, Field, Input, cx } from '../../../components/ui';
import { useToast } from '../../../components/Toast';
import { orderKeys, uploadDocument } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { errorMessage, fmtDate, today } from '../../../lib/format';
import { SHIPMENT_STATUS } from '../../../lib/workflows';
import type { OrderListRow, Shipment, ShipmentStatus } from '../../../lib/types';

const COURIERS = ['DHL Express', 'FedEx', 'UPS', 'Aramex', 'Brink’s', 'Malca-Amit', 'Ferrari Group', 'Sequel', 'BVC', 'TNT', 'India Post'];

/** Builds the courier's official public tracking page URL when we know the pattern. */
export function suggestTrackingUrl(courier: string, tracking: string): string {
  const t = encodeURIComponent(tracking.trim());
  if (!t) return '';
  const c = courier.toLowerCase();
  if (c.includes('dhl')) return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${t}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${t}`;
  if (c.includes('aramex')) return `https://www.aramex.com/us/en/track/results?ShipmentNumber=${t}`;
  if (c.includes('tnt')) return `https://www.tnt.com/express/en_gc/site/shipping-tools/tracking.html?searchType=con&cons=${t}`;
  return '';
}

export function ShippingSection({ order, shipments }: { order: OrderListRow; shipments: Shipment[] }) {
  const [drawer, setDrawer] = useState<{ open: boolean; shipment?: Shipment }>({ open: false });
  const qc = useQueryClient();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const openShipment = shipments.find((s) => s.status !== 'delivered');

  async function markDelivered(s: Shipment) {
    setBusyId(s.id);
    const { error } = await supabase.from('shipments').update({ status: 'delivered' }).eq('id', s.id);
    setBusyId(null);
    if (error) return toast.error(errorMessage(error));
    orderKeys(order.id).forEach((k) => qc.invalidateQueries({ queryKey: k }));
    const remaining = shipments.filter((x) => x.id !== s.id && x.status !== 'delivered').length;
    toast.success(remaining ? 'Shipment delivered' : 'Delivered — order completed');
  }

  return (
    <Card
      title="Shipping"
      action={<Button size="sm" icon={<Truck className="h-3.5 w-3.5" />} onClick={() => setDrawer({ open: true, shipment: openShipment })}>Update Shipping</Button>}
    >
      {shipments.length === 0 ? (
        <div className="py-2 text-sm text-slate-500">Shipment tracking will appear here once available.</div>
      ) : (
        <ul className="space-y-3">
          {shipments.map((s, i) => (
            <li key={s.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{shipments.length > 1 ? `Shipment ${i + 1} · ` : ''}{s.courier}</span>
                <Badge tone={SHIPMENT_STATUS[s.status].tone}>{SHIPMENT_STATUS[s.status].label}</Badge>
                <button className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-indigo" onClick={() => setDrawer({ open: true, shipment: s })} aria-label="Edit shipment"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-slate-500">Tracking no.</dt>
                <dd className="flex items-center gap-1 font-medium">
                  {s.tracking_number ? <>{s.tracking_number}<button onClick={() => { navigator.clipboard?.writeText(s.tracking_number!); toast.success('Tracking number copied'); }} className="text-slate-400 hover:text-brand-indigo" aria-label="Copy"><Copy className="h-3 w-3" /></button></> : <span className="text-orange-700">Missing</span>}
                </dd>
                <dt className="text-slate-500">Shipped</dt><dd>{fmtDate(s.shipped_date)}</dd>
                <dt className="text-slate-500">Est. delivery</dt><dd>{fmtDate(s.estimated_delivery_date)}</dd>
                {s.delivered_at && <><dt className="text-slate-500">Delivered</dt><dd>{fmtDate(s.delivered_at)}</dd></>}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-brand-indigo hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Track</a>}
                {s.status !== 'delivered' && <Button size="sm" variant="indigo" icon={<Check className="h-3.5 w-3.5" />} loading={busyId === s.id} onClick={() => markDelivered(s)}>Mark delivered</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {shipments.length > 0 && (
        <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-indigo hover:underline" onClick={() => setDrawer({ open: true })}><Plus className="h-3 w-3" /> Add another shipment</button>
      )}
      <ShipmentDrawer open={drawer.open} shipment={drawer.shipment} order={order} onClose={() => setDrawer({ open: false })} />
    </Card>
  );
}

function ShipmentDrawer({ open, onClose, order, shipment }: { open: boolean; onClose: () => void; order: OrderListRow; shipment?: Shipment }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [url, setUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [shipped, setShipped] = useState('');
  const [eta, setEta] = useState('');
  const [status, setStatus] = useState<ShipmentStatus>('shipped');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null); setFile(null);
    setCourier(shipment?.courier || ''); setTracking(shipment?.tracking_number || ''); setUrl(shipment?.tracking_url || '');
    setUrlTouched(!!shipment?.tracking_url); setShipped(shipment?.shipped_date || today());
    setEta(shipment?.estimated_delivery_date || order.expected_delivery_date || ''); setStatus(shipment?.status || 'shipped');
  }, [open, shipment, order.expected_delivery_date]);

  useEffect(() => {
    if (!urlTouched) setUrl(suggestTrackingUrl(courier, tracking));
  }, [courier, tracking, urlTouched]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!courier.trim()) return setError('Enter the courier company.');
    if (url && !/^https?:\/\//i.test(url.trim())) return setError('Tracking URL must start with https://');
    setBusy(true);
    setError(null);
    try {
      let documentId = shipment?.document_id ?? null;
      if (file) documentId = (await uploadDocument(order.id, file, { doc_type: 'shipping_document', customer_visible: true, name: file.name })).id;
      const values = { courier: courier.trim(), tracking_number: tracking.trim() || null, tracking_url: url.trim() || null, shipped_date: shipped || null, estimated_delivery_date: eta || null, status, document_id: documentId };
      const res = shipment ? await supabase.from('shipments').update(values).eq('id', shipment.id) : await supabase.from('shipments').insert({ ...values, order_id: order.id });
      if (res.error) throw res.error;
      orderKeys(order.id).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(status === 'delivered' ? 'Shipment marked delivered' : 'Shipping updated — customer can track it now');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={shipment ? 'Update shipping' : 'Add shipment'}
      subtitle={order.reference}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="shipment-form" loading={busy}>Save shipping</Button>
      </>}
    >
      <form id="shipment-form" onSubmit={save} className="space-y-4">
        <Field label="Courier company" required>
          <Input list="courier-list" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. FedEx" maxLength={80} autoFocus />
          <datalist id="courier-list">{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Tracking number"><Input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={120} /></Field>
        <Field label="Tracking URL" hint={!urlTouched && url ? 'Filled automatically from the courier’s official tracking page.' : 'Link to the courier’s official tracking page.'}>
          <Input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setUrlTouched(true); }} placeholder="https://…" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Shipping date"><Input type="date" value={shipped} onChange={(e) => setShipped(e.target.value)} /></Field>
          <Field label="Estimated delivery"><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></Field>
        </div>
        <Field label="Delivery status" group>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(SHIPMENT_STATUS) as ShipmentStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={cx('rounded-lg border px-2 py-2 text-[13px] transition', status === s ? 'border-brand-indigo bg-cream-100 font-medium text-brand-indigo ring-1 ring-brand-indigo' : 'border-slate-200 text-slate-700')}>
                {SHIPMENT_STATUS[s].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Shipped / In transit completes the “Shipped” stage. When all shipments are Delivered, the order is completed.</p>
        </Field>
        <Field label="Shipping document (optional)" hint="Visible to the customer.">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-indigo" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Drawer>
  );
}
