export type Role = 'admin' | 'team' | 'customer';
export type OrderType = 'diamond' | 'jewellery';
export type OrderStatus = 'active' | 'completed' | 'cancelled';
export type StageStatus = 'upcoming' | 'in_progress' | 'completed' | 'attention' | 'blocked' | 'not_applicable';
export type PaymentStatus = 'initiated' | 'confirmed' | 'failed';
export type OrderPaymentStatus = 'no_amount' | 'unpaid' | 'initiated' | 'partial' | 'paid';
export type ShipmentStatus = 'preparing' | 'shipped' | 'in_transit' | 'delivered';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  customer_id: string | null;
  job_title: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
  email: string;
  phone: string | null;
  country: string;
  address: string | null;
  internal_notes: string | null;
  assigned_executive_id: string;
  portal_invited_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerListRow extends Customer {
  executive_name: string | null;
  active_orders: number;
  completed_orders: number;
  last_activity: string;
  portal_status: 'not_invited' | 'invited' | 'active' | 'disabled' | null;
}

export interface Order {
  id: string;
  reference: string;
  customer_id: string;
  order_type: OrderType;
  title: string;
  customer_po_ref: string | null;
  currency: string;
  proforma_amount: number | null;
  final_invoice_amount: number | null;
  amount_received: number;
  balance_due: number | null;
  payment_terms: string | null;
  customer_action_required: string | null;
  current_responsible_dept: string | null;
  payment_status: OrderPaymentStatus;
  expected_delivery_date: string | null;
  notes: string | null;
  status: OrderStatus;
  executive_override_id: string | null;
  current_stage_key: string | null;
  current_stage_name: string | null;
  current_stage_status: StageStatus | null;
  progress_pct: number;
  feedback_rating: number | null;
  feedback_comment: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListRow extends Order {
  customer_name: string;
  customer_country: string;
  executive_id: string;
  executive_name: string | null;
  total_amount: number | null;
  next_action: string | null;
}

export interface Stage {
  id: string;
  order_id: string;
  stage_key: string;
  name: string;
  position: number;
  journey_position: number;
  is_payment_stage: boolean;
  status: StageStatus;
  completed_at: string | null;
  customer_note: string | null;
  details: Record<string, string>;
  updated_at: string;
}

export interface OrderUpdate {
  id: string;
  order_id: string;
  stage_name: string | null;
  status: string | null;
  note: string | null;
  customer_visible: boolean;
  document_id: string | null;
  created_at: string;
  author?: { full_name: string } | null;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  method: string;
  payment_type: 'advance' | 'partial' | 'final';
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  document_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  author?: { full_name: string } | null;
}

export interface Doc {
  id: string;
  order_id: string;
  name: string;
  doc_type: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  customer_visible: boolean;
  created_by: string | null;
  created_at: string;
  author?: { full_name: string } | null;
}

export interface Shipment {
  id: string;
  order_id: string;
  courier: string;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_date: string | null;
  estimated_delivery_date: string | null;
  status: ShipmentStatus;
  delivered_at: string | null;
  document_id: string | null;
  created_at: string;
}

export interface AppSettings {
  company_name: string;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  default_currency: string;
  team_sees_all: boolean;
}

export interface Executive {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
}

export interface PortalOrderCard {
  id: string;
  reference: string;
  order_type: OrderType;
  title: string;
  customer_po_ref: string | null;
  status: OrderStatus;
  current_stage_name: string | null;
  current_stage_status: StageStatus | null;
  progress_pct: number;
  currency: string;
  total_amount: number | null;
  expected_delivery_date: string | null;
  updated_at: string;
  created_at: string;
  completed_at: string | null;
  latest_update: { note: string | null; stage_name: string | null; created_at: string } | null;
}

export interface PortalHome {
  customer: { id: string; name: string; contact_person: string | null; email: string; phone: string | null; country: string; address: string | null };
  me: { full_name: string; email: string; phone: string | null };
  executive: Executive | null;
  company: { company_name: string; tagline: string | null; email: string | null; phone: string | null; whatsapp: string | null; website: string | null };
  orders: PortalOrderCard[];
}

export interface PortalOrder {
  extra: {
    payment_terms: string | null; customer_action_required: string | null; current_responsible_dept: string | null;
    stage_positions: Record<string, number>;
    stage_documents: { stage_id: string; document_id: string; created_at: string }[];
    cad_approvals: { document_id: string; approved_at: string }[];
    approvals?: PortalApproval[];
    metal_supplies?: { metal_type: string; metal_purity: string | null; metal_weight: number | null; status: string; supplied_date: string | null }[];
    photography?: { status: string; completed_at: string | null } | null;
  };
  order: {
    id: string; reference: string; order_type: OrderType; title: string; customer_po_ref: string | null;
    status: OrderStatus; current_stage_key: string | null; current_stage_name: string | null;
    current_stage_status: StageStatus | null; progress_pct: number; expected_delivery_date: string | null;
    created_at: string; updated_at: string; completed_at: string | null;
    feedback_rating: number | null; feedback_comment: string | null;
  };
  payment: {
    currency: string; proforma_amount: number | null; final_invoice_amount: number | null;
    amount_received: number; balance_due: number | null; payment_status: OrderPaymentStatus;
    payments: { id: string; amount: number; currency: string; payment_date: string; payment_type: string; status: PaymentStatus; reference: string | null }[];
  };
  executive: Executive | null;
  stages: { id: string; stage_key: string; name: string; position: number; status: StageStatus; completed_at: string | null; customer_note: string | null; details: Record<string, string> }[];
  updates: { id: string; stage_name: string | null; status: string | null; note: string | null; created_at: string }[];
  documents: { id: string; name: string; doc_type: string; storage_path: string; mime_type: string | null; size_bytes: number | null; created_at: string }[];
  shipments: { id: string; courier: string; tracking_number: string | null; tracking_url: string | null; shipped_date: string | null; estimated_delivery_date: string | null; status: ShipmentStatus; delivered_at: string | null }[];
}

export interface PortalApproval {
  id: string; stage_key: string; approval_type: string; version: number; file_path: string; file_name: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'superseded'; customer_approval_required: boolean;
  rejection_reason: string | null; rejection_notes: string | null; decided_at: string | null; created_at: string;
}
export interface OrderApproval extends PortalApproval { order_id: string; document_id: string | null; internal_qc_status: 'pending' | 'passed' | 'rework_required' }
