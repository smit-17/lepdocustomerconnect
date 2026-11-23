import { describe, expect, it } from 'vitest';
import { sharedCustomer, sharedHome, sharedOrderView } from '@/lepdo/lib/shared-profile';

const order = {
  id: '00000000-0000-4000-8000-000000000001', reference: 'LPD-2026-0004', title: 'Diamond order', order_type: 'diamond', status: 'active',
  current_stage_key: 'proforma_invoice', current_stage_name: 'Proforma Invoice', current_stage_status: 'in_progress', progress_pct: 0,
  expected_delivery_date: null, created_at: '2026-11-23', updated_at: '2026-11-23', completed_at: null,
  stages: [{ id: '00000000-0000-4000-8000-000000000002', stage_key: 'proforma_invoice', name: 'Proforma Invoice', position: 1, status: 'in_progress', completed_at: null }],
};
describe('Shared read-only customer profile', () => {
  it('permits company name and country, excluding sensitive personal details', () => {
    const result = sharedCustomer.parse({ customer: { name: 'Customer company', country: 'India', email: 'private@example.com', phone: 'private', address: 'private', kyc: 'private' }, orders: [] });
    expect(result.customer).toEqual({ name: 'Customer company', country: 'India' });
    expect(sharedHome(result).me).toEqual({ full_name: '', email: '', phone: null });
  });
  it('preserves live order progress without financial, internal or file data', () => {
    const result = sharedCustomer.parse({ customer: { name: 'Company', country: 'India' }, orders: [{ ...order, notes: 'Private', amount_received: 500, documents: [{ storage_path: 'private.pdf' }], stages: order.stages.map(s => ({ ...s, details: { private: 'secret' } })) }] });
    const first = result.orders[0];
    if (!first) throw new Error('Missing shared order');
    expect(first.current_stage_status).toBe('in_progress');
    expect(first).not.toHaveProperty('amount_received');
    expect(first).not.toHaveProperty('documents');
    expect(first).not.toHaveProperty('notes');
    const view = sharedOrderView(first);
    expect(view.documents).toEqual([]);
    expect(view.payment.payments).toEqual([]);
    expect(view.stages[0]?.details).toEqual({});
    expect(view.extra.stage_positions[first.stages[0]?.id || 'missing']).toBe(1);
  });
  it('does not infer or add orders absent from the permitted customer response', () => {
    const result = sharedCustomer.parse({ customer: { name: 'Company', country: 'India' }, orders: [order] });
    expect(sharedHome(result).orders.map(o => o.id)).toEqual(['00000000-0000-4000-8000-000000000001']);
  });
  it('shows shared stage descriptions and labels without exposing recorded private values', () => {
    const result = sharedCustomer.parse({ customer: { name: 'Company', country: 'India' }, orders: [{ ...order, stages: order.stages.map(s => ({ ...s, ui_schema: { description: 'Custom public description', fields: [{ key: 'custom', label: 'Custom label', type: 'text' }] }, details: { custom: 'Private recorded value' } })) }] });
    const first = result.orders[0];
    if (!first) throw new Error('Missing order');
    expect(sharedOrderView(first).stages[0]?.ui_schema?.description).toBe('Custom public description');
    expect(sharedOrderView(first).stages[0]?.details).toEqual({});
  });
});