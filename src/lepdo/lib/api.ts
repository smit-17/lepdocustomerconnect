import { useQuery } from '@tanstack/react-query';
import { supabase, DOCS_BUCKET } from './supabase';
import { cleanSearch } from './format';
import { DOC_TYPES, orderActionsLocked } from './workflows';
import { changeTeamEmail, inviteUser, type InviteInput } from './invite.functions';
import type { AppSettings, CustomerListRow, Doc, OrderListRow, OrderUpdate, Payment, PortalHome, PortalOrder, Profile, Shipment, Stage } from './types';

/** Throws Supabase errors so React Query surfaces them. */
export async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const keys = {
  staff: ['staff'] as const,
  settings: ['settings'] as const,
  customers: (q: string) => ['customers', q] as const,
  customer: (id: string) => ['customer', id] as const,
  orders: (f: object) => ['orders', f] as const,
  order: (id: string) => ['order', id] as const,
  stages: (id: string) => ['stages', id] as const,
  updates: (id: string) => ['updates', id] as const,
  payments: (id: string) => ['payments', id] as const,
  documents: (id: string) => ['documents', id] as const,
  shipments: (id: string) => ['shipments', id] as const,
  dashboard: ['dashboard'] as const,
  portalHome: ['portal-home'] as const,
  portalOrder: (id: string) => ['portal-order', id] as const,
  directory: ['directory'] as const,
};

/* ------------------------------------------------------------- Staff side */

export function useStaff() {
  return useQuery({
    queryKey: keys.staff,
    queryFn: () => run<Profile[]>(supabase.from('profiles').select('*').in('role', ['admin', 'team']).order('full_name')),
    staleTime: 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => run<AppSettings>(supabase.from('app_settings').select('*').eq('id', 1).single()),
    staleTime: 5 * 60_000,
  });
}

export function useCustomers(search = '') {
  return useQuery({
    queryKey: keys.customers(search),
    queryFn: () => {
      let q = supabase.from('customer_list').select('*').order('last_activity', { ascending: false }).limit(500);
      const s = cleanSearch(search);
      if (s) q = q.or(`name.ilike.%${s}%,contact_person.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
      return run<CustomerListRow[]>(q);
    },
    placeholderData: (prev) => prev,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: keys.customer(id),
    queryFn: () => run<CustomerListRow>(supabase.from('customer_list').select('*').eq('id', id).single()),
  });
}

export interface OrderFilters {
  status?: 'active' | 'completed' | 'cancelled';
  customerId?: string;
  type?: string;
  stage?: string;
  executiveId?: string;
  search?: string;
  limit?: number;
  attention?: string;
}

export function useOrders(f: OrderFilters) {
  return useQuery({
    queryKey: keys.orders(f),
    queryFn: async () => {
      let q = supabase.from('order_list').select('*').order('updated_at', { ascending: false }).limit(f.limit ?? 500);
      if (f.status) q = q.eq('status', f.status);
      if (f.customerId) q = q.eq('customer_id', f.customerId);
      if (f.type) q = q.eq('order_type', f.type);
      if (f.stage) q = q.eq('current_stage_key', f.stage);
      if (f.executiveId) q = q.eq('executive_id', f.executiveId);
      if (f.attention === 'payment') {
        const pending = await run<string[]>(supabase.rpc('staff_pending_payment_orders'));
        if (!pending.length) return [];
        q = q.in('id', pending);
      }
      if (f.attention === 'cad') q = q.eq('current_stage_key', 'cad_approval');
      if (f.attention === 'qc') q = q.eq('current_stage_key', 'quality_check');
      if (f.attention === 'dispatch') q = q.eq('current_stage_key', 'ready_to_ship');
      const s = cleanSearch(f.search || '');
      if (s) q = q.or(`reference.ilike.%${s}%,customer_name.ilike.%${s}%,title.ilike.%${s}%,customer_po_ref.ilike.%${s}%`);
      const orders = await run<OrderListRow[]>(q);
      if (!orders.length) return orders;
      const handovers = await run<Pick<Stage, 'order_id' | 'stage_key' | 'status'>[]>(
        supabase.from('order_stages').select('order_id,stage_key,status').in('order_id', orders.map(o => o.id)).eq('stage_key', 'shipped').eq('status', 'completed').gt('journey_position', 0),
      );
      const handedOver = new Set(handovers.map(s => s.order_id));
      return orders.map(o => ({ ...o, actions_locked: orderActionsLocked(o.status, handedOver.has(o.id) ? [{ stage_key: 'shipped', status: 'completed' }] : []) }));
    },
    placeholderData: (prev) => prev,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => run<OrderListRow>(supabase.from('order_list').select('*').eq('id', id).single()),
  });
}

export function useStages(orderId: string) {
  return useQuery({
    queryKey: keys.stages(orderId),
    queryFn: () => run<Stage[]>(supabase.from('order_stages').select('*').eq('order_id', orderId).gt('journey_position', 0).order('journey_position')),
  });
}

export function useUpdates(orderId: string) {
  return useQuery({
    queryKey: keys.updates(orderId),
    queryFn: () =>
      run<OrderUpdate[]>(
        supabase.from('order_updates').select('*, author:profile_history!order_updates_created_by_fkey(full_name)').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100),
      ),
  });
}

export function usePayments(orderId: string) {
  return useQuery({
    queryKey: keys.payments(orderId),
    queryFn: () =>
      run<Payment[]>(supabase.from('payments').select('*, author:profile_history!payments_created_by_fkey(full_name)').eq('order_id', orderId).order('payment_date').order('created_at')),
  });
}

export function useDocuments(orderId: string) {
  return useQuery({
    queryKey: keys.documents(orderId),
    queryFn: () =>
      run<Doc[]>(supabase.from('documents').select('*, author:profile_history!documents_created_by_fkey(full_name)').eq('order_id', orderId).order('created_at', { ascending: false })),
  });
}

export function useShipments(orderId: string) {
  return useQuery({
    queryKey: keys.shipments(orderId),
    queryFn: () => run<Shipment[]>(supabase.from('shipments').select('*').eq('order_id', orderId).order('created_at')),
  });
}

/** Everything that changes when an order changes. */
export function orderKeys(orderId: string) {
  return [keys.order(orderId), keys.stages(orderId), keys.updates(orderId), keys.payments(orderId), keys.documents(orderId), keys.shipments(orderId), ['orders'], ['customers'], ['customer'], keys.dashboard];
}

/* -------------------------------------------------------------- Documents */

function safeName(name: string) {
  return name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'file';
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function uploadDocument(
  orderId: string,
  file: File,
  meta: { name?: string; doc_type: string; customer_visible: boolean },
): Promise<Doc> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
  const path = `${orderId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const up = await supabase.storage.from(DOCS_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase
    .from('documents')
    .insert({
      order_id: orderId,
      name: (meta.name || file.name).trim().slice(0, 200),
      doc_type: meta.doc_type,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      customer_visible: meta.customer_visible,
    })
    .select('*')
    .single();
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
    if (/documents_doc_type_check/.test(String(error.message)))
      throw new Error(`"${DOC_TYPES[meta.doc_type]?.label || meta.doc_type}" documents can't be saved yet: the database needs updating to accept this type.`);
    throw error;
  }
  return data as Doc;
}

/** Short-lived signed URL (60 s) — documents are never publicly reachable. */
export async function openDocument(path: string, fileName: string, download = true) {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 60, download ? { download: fileName } : undefined);
  if (error || !data) throw error || new Error('Could not open document');
  // Same-tab navigation to an attachment URL downloads the file without leaving
  // the page, and is not blocked by mobile pop-up blockers.
  if (download) window.location.assign(data.signedUrl);
  else window.open(data.signedUrl, '_blank', 'noopener');
}

/* ------------------------------------------------------------ Invitations */

export async function sendInvite(body: { kind: 'customer'; customer_id: string; email?: string; full_name?: string } | { kind: 'team'; email: string; full_name: string; phone?: string; role: 'team' | 'admin' }) {
  return inviteUser({ data: { ...body, redirect_to: `${window.location.origin}/set-password` } as InviteInput });
}

/* ----------------------------------------------------------------- Portal */

export function usePortalHome() {
  return useQuery({ queryKey: keys.portalHome, queryFn: () => run<PortalHome>(supabase.rpc('portal_home')), refetchOnWindowFocus: true });
}

export function usePortalOrder(id: string) {
  return useQuery({ queryKey: keys.portalOrder(id), queryFn: async () => {
    const [order, extra] = await Promise.all([
      run<Omit<PortalOrder, 'extra'>>(supabase.rpc('portal_order', { p_order_id: id })),
      run<PortalOrder['extra']>(supabase.rpc('portal_order_extra', { p_order_id: id })),
    ]);
    return { ...order, extra };
  }, refetchOnWindowFocus: true, retry: false });
}

export function updateTeamEmail(userId: string, email: string) {
  return changeTeamEmail({ data: { user_id: userId, email } });
}
