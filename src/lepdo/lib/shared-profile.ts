import { z } from 'zod';
import type { PortalHome, PortalOrder } from './types';
import { stageSchema } from './workflow-editor';

const stageStatus = z.enum(['upcoming', 'in_progress', 'completed', 'attention', 'blocked', 'not_applicable']);
const sharedOrder = z.object({
  id: z.string().uuid(), reference: z.string(), title: z.string(),
  order_type: z.enum(['diamond', 'jewellery']), status: z.enum(['active', 'completed', 'cancelled']),
  current_stage_key: z.string().nullable(), current_stage_name: z.string().nullable(),
  current_stage_status: stageStatus.nullable(), progress_pct: z.number(),
  expected_delivery_date: z.string().nullable(), created_at: z.string(), updated_at: z.string(), completed_at: z.string().nullable(),
  stages: z.array(z.object({ id: z.string().uuid(), stage_key: z.string(), name: z.string(), position: z.number(), status: stageStatus, completed_at: z.string().nullable(), ui_schema: stageSchema.nullable().optional() })),
});
export const sharedCustomer = z.object({ customer: z.object({ name: z.string(), country: z.string() }), orders: z.array(sharedOrder) });
export type SharedCustomer = z.infer<typeof sharedCustomer>;

// Empty private fields adapt the allowlisted response to existing portal views;
// no authenticated identity, files, payments or contact data are requested.
export function sharedHome(data: SharedCustomer): PortalHome {
  return {
    customer: { ...data.customer, id: '', contact_person: null, email: '', phone: null, address: null },
    me: { full_name: '', email: '', phone: null }, executive: null,
    company: { company_name: 'LEPDO', tagline: null, email: null, phone: null, whatsapp: null, website: null },
    orders: data.orders.map(o => ({ ...o, customer_po_ref: null, currency: '', total_amount: null, latest_update: null })),
  };
}
export function sharedOrderView(o: SharedCustomer['orders'][number]): PortalOrder {
  return {
    order: { ...o, customer_po_ref: null, feedback_rating: null, feedback_comment: null },
    extra: { payment_terms: null, customer_action_required: null, current_responsible_dept: null,
      stage_positions: Object.fromEntries(o.stages.map(s => [s.id, s.position])), stage_documents: [], cad_approvals: [], approvals: [] },
    stages: o.stages.map(({ ui_schema, ...s }) => ({ ...s, ...(ui_schema !== undefined ? { ui_schema } : {}), customer_note: null, details: {} })),
    payment: { currency: '', proforma_amount: null, final_invoice_amount: null, amount_received: 0, balance_due: null, payment_status: 'no_amount', payments: [] },
    executive: null, documents: [], shipments: [], updates: [],
  };
}