import type { OrderType, StageStatus, ShipmentStatus, OrderPaymentStatus, PaymentStatus } from './types';

/** Optional operational details recorded inside a main stage (keeps the timeline short). */
export const STAGE_DETAILS: Record<OrderType, Record<string, { key: string; label: string }[]>> = {
  diamond: {
    bank_details: [{ key: 'bank_details_shared', label: 'Bank details shared' }],
    tracking: [{ key: 'tracking_added', label: 'Tracking details added' }],
    proforma: [{ key: 'bank_details_shared', label: 'Bank details shared' }],
    payment_in_progress: [
      { key: 'payment_initiated', label: 'Payment initiated' },
      { key: 'payment_reflected', label: 'Payment reflected' },
      { key: 'payment_documents_submitted', label: 'Required payment documents submitted' },
    ],
    payment_confirmed: [
      { key: 'payment_confirmed_received', label: 'Payment confirmed received' },
      { key: 'invoice_uploaded', label: 'Applicable invoice uploaded' },
    ],
    quality_check: [{ key: 'diamond_qc_completed', label: 'Diamond QC completed' }],
    ready_to_ship: [{ key: 'parcel_packed', label: 'Parcel packed' }],
    final_invoice: [{ key: 'final_invoice_issued', label: 'Final invoice issued' }],
    shipped: [{ key: 'tracking_added', label: 'Tracking details added' }],
  },
  jewellery: {
    diamond_preparation: [{ key: 'preparation_started', label: 'Preparation started' }],
    final_invoice: [{ key: 'final_invoice_issued', label: 'Final invoice issued' }],
    advance_payment: [{ key: 'advance_received', label: 'Advance payment received' }],
    cad_approval: [
      { key: 'requirements_shared', label: 'CAD creation — specs confirmed' },
      { key: 'cad_received', label: 'CAD file uploaded' },
      { key: 'internal_qc_passed', label: 'Internal CAD QC passed' },
      { key: 'customer_approved', label: 'Customer approved CAD' },
      { key: 'cad_approved', label: 'CAD approved' },
      { key: 'rework_required', label: 'Rework required' },
    ],
    manufacturing: [
      { key: 'metal_supply_received', label: 'Metal supply received' },
      { key: 'materials_issued', label: 'Diamond and metal issued' },
      { key: 'manufacturing_started', label: 'Manufacturing started' },
      { key: 'in_making', label: 'In making' },
      { key: 'manufacturing_completed', label: 'Manufacturing completed' },
    ],
    quality_check: [
      { key: 'qc_completed', label: 'QC completed' },
      { key: 'recheck_required', label: 'Recheck required' },
      { key: 'photos_uploaded', label: 'Jewellery photography completed' },
      { key: 'customer_approved', label: 'Customer approved QC' },
    ],
    ready_to_ship: [{ key: 'parcel_packed', label: 'Parcel packed' }],
    final_payment: [{ key: 'final_invoice_issued', label: 'Final invoice issued' }],
    shipped: [{ key: 'tracking_added', label: 'Tracking details added' }],
  },
};

export function stageDetails(type: OrderType, stageKey: string) {
  return STAGE_DETAILS[type]?.[stageKey] ?? [];
}

export const PAYMENT_STAGE_KEYS = ['proforma', 'payment_in_progress', 'payment_confirmed', 'advance_payment', 'final_payment'];

export const STAGE_STATUS: Record<StageStatus, { label: string; customerLabel: string }> = {
  upcoming: { label: 'Upcoming', customerLabel: 'Upcoming' },
  in_progress: { label: 'In progress', customerLabel: 'In progress' },
  completed: { label: 'Completed', customerLabel: 'Completed' },
  attention: { label: 'Approval / recheck required', customerLabel: 'Awaiting approval' },
  blocked: { label: 'Blocked', customerLabel: 'On hold' },
  not_applicable: { label: 'Not applicable', customerLabel: 'Not applicable' },
};
export const STAGE_STATUS_OPTIONS: StageStatus[] = ['in_progress', 'completed', 'attention', 'blocked', 'not_applicable', 'upcoming'];

/** Unique stage names across both workflows, for the Orders filter. */
export const ALL_STAGES: { key: string; label: string }[] = [
  { key: 'bank_details', label: 'Bank Details' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'order_confirmed', label: 'Order Confirmed' },
  { key: 'proforma', label: 'Proforma Invoice & Payment Details' },
  { key: 'payment_in_progress', label: 'Payment In Progress' },
  { key: 'payment_confirmed', label: 'Payment Confirmed' },
  { key: 'advance_payment', label: 'Advance Payment Confirmed' },
  { key: 'diamond_preparation', label: 'Diamond Preparation' },
  { key: 'cad_approval', label: 'CAD & Design Approval' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'ready_to_ship', label: 'Ready to Ship' },
  { key: 'final_payment', label: 'Final Payment Confirmed' },
  { key: 'final_invoice', label: 'Final Invoice Issued' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

export const ORDER_TYPE_LABEL: Record<OrderType, string> = { diamond: 'Diamond', jewellery: 'Jewellery' };

export const ORDER_PAYMENT_STATUS: Record<OrderPaymentStatus, { label: string; tone: Tone }> = {
  no_amount: { label: 'Amount not set', tone: 'grey' },
  unpaid: { label: 'Unpaid', tone: 'amber' },
  initiated: { label: 'Payment initiated', tone: 'blue' },
  partial: { label: 'Partially paid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; customerLabel: string; tone: Tone }> = {
  initiated: { label: 'Initiated', customerLabel: 'Initiated — awaiting confirmation', tone: 'blue' },
  confirmed: { label: 'Received / Confirmed', customerLabel: 'Received', tone: 'green' },
  failed: { label: 'Failed / Cancelled', customerLabel: 'Failed', tone: 'red' },
};

export const PAYMENT_METHODS: Record<string, string> = {
  bank_transfer: 'International wire (SWIFT)',
  local_transfer: 'Local bank transfer',
  card: 'Card',
  cash: 'Cash',
  other: 'Other',
};

export const PAYMENT_TYPES: Record<string, string> = { advance: 'Advance', partial: 'Part payment', final: 'Final / balance' };

export const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; tone: Tone }> = {
  preparing: { label: 'Preparing', tone: 'grey' },
  shipped: { label: 'Shipped', tone: 'indigo' },
  in_transit: { label: 'In transit', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'green' },
};

export const DOC_TYPES: Record<string, { label: string; visible: boolean }> = {
  proforma_invoice: { label: 'Proforma Invoice', visible: true },
  bank_details: { label: 'Bank Details', visible: true },
  payment_confirmation: { label: 'Payment Confirmation', visible: true },
  final_invoice: { label: 'Final Invoice', visible: true },
  commercial_invoice: { label: 'Commercial Invoice', visible: true },
  gst_invoice: { label: 'GST Invoice', visible: true },
  diamond_certificate: { label: 'Diamond Certificate', visible: true },
  cad_design: { label: 'CAD Design', visible: true },
  qc_image: { label: 'QC Image', visible: true },
  jewellery_photo: { label: 'Jewellery Photo', visible: true },
  shipping_document: { label: 'Shipping Document', visible: true },
  other: { label: 'Other Document', visible: false },
};

/** Sensible document type when a file is attached to a progress update. */
export function docTypeForStage(stageKey: string): string {
  switch (stageKey) {
    case 'proforma': return 'proforma_invoice';
    case 'bank_details': return 'bank_details';
    case 'payment_in_progress':
    case 'payment_confirmed':
    case 'advance_payment':
    case 'final_payment': return 'payment_confirmation';
    case 'cad_approval': return 'cad_design';
    case 'quality_check': return 'qc_image';
    case 'manufacturing': return 'jewellery_photo';
    case 'final_invoice': return 'final_invoice';
    case 'tracking':
    case 'shipped': return 'shipping_document';
    default: return 'other';
  }
}

export function journeyProgress(stages: { stage_key: string; status: StageStatus }[], orderStatus?: string) {
  if (orderStatus === 'completed') return 100;
  const required = stages.filter(s => s.stage_key !== 'feedback' && s.status !== 'not_applicable');
  return required.length ? Math.round(100 * required.filter(s => s.status === 'completed').length / required.length) : 0;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'HKD', 'AUD', 'CAD', 'SGD', 'CHF', 'JPY'];

export type Tone = 'grey' | 'green' | 'amber' | 'red' | 'blue' | 'indigo' | 'orange' | 'cream';

export const COUNTRIES = [
  'Australia', 'Austria', 'Bahrain', 'Belgium', 'Brazil', 'Canada', 'China', 'Denmark', 'France', 'Germany',
  'Hong Kong', 'India', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kuwait', 'Malaysia', 'Mexico', 'Netherlands',
  'New Zealand', 'Norway', 'Oman', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'United Arab Emirates', 'United Kingdom', 'United States',
];

export const REJECTION_REASONS = ['Design alteration needed', 'Dimensions mismatch', 'Stone setting revision', 'Finish defect', 'Other'];
/** Step editing is reserved for administrators on non-cancelled orders. */
export function canEditOrderSteps(isAdmin: boolean, status: string) {
  return isAdmin && status !== 'cancelled';
}

export function moveStageIds(ids: string[], index: number, direction: -1 | 1): string[] | null {
  const target = index + direction;
  const currentId = ids[index];
  const targetId = ids[target];
  if (currentId === undefined || targetId === undefined) return null;
  const result = [...ids];
  result[index] = targetId;
  result[target] = currentId;
  return result;
}
export const INVOICE_DOC_TYPES = ['proforma_invoice', 'final_invoice', 'commercial_invoice', 'gst_invoice'];
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'superseded';
export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting customer', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  changes_requested: { label: 'Changes requested', tone: 'red' },
  superseded: { label: 'Superseded', tone: 'grey' },
};

/** Invoice-step document and amount mapping shared by staff controls and tests. */
export const INVOICE_STEPS: Record<string, { docType: string; amountField: 'proforma_amount' | 'final_invoice_amount'; label: string; detailKey?: string }> = {
  proforma: { docType: 'proforma_invoice', amountField: 'proforma_amount', label: 'Proforma invoice' },
  final_invoice: { docType: 'final_invoice', amountField: 'final_invoice_amount', label: 'Final invoice', detailKey: 'final_invoice_issued' },
};

export function parseInvoiceAmount(amount: string): number | null {
  const trimmed = amount.replace(/,/g, '').trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) throw new Error('Amount must be a non-negative number.');
  return num;
}

export function validateNewStageName(value: string): string {
  const name = value.trim();
  if (!name || [...name].length > 120) throw new Error('Step name must contain 1 to 120 characters.');
  return name;
}
