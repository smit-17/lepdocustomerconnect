import { describe, expect, it } from 'vitest';
import { moveItem, optionalPaymentAmount, orderWorkflow, schemaForStage, workflowDefinition } from '@/lepdo/lib/workflow-editor';
import type { Stage } from '@/lepdo/lib/types';

const stage: Stage = { id: 'one', order_id: 'order', stage_key: 'quality_check', name: 'Inspection', position: 6, journey_position: 6, is_payment_stage: false, status: 'completed', completed_at: '2026-11-23T10:00:00Z', customer_note: 'Done', details: { diamond_qc_completed: '2026-11-23' }, updated_at: '2026-11-23' };
describe('Order-specific and universal workflow customization', () => {
  it('uses the exact individual field schema, including explicitly removed fields', () => {
    expect(schemaForStage('diamond', { ...stage, ui_schema: { description: 'Custom', fields: [] } })).toEqual({ description: 'Custom', fields: [] });
    expect(schemaForStage('diamond', stage).fields[0]?.key).toBe('diamond_qc_completed');
  });
  it('creates editable definitions without resetting completed progress or field values', () => {
    const before = structuredClone(stage);
    const result = orderWorkflow('diamond', [stage]);
    if (!result[0]) throw new Error('Missing stage');
    result[0].name = 'Changed';
    expect(stage).toEqual(before);
    expect(stage.status).toBe('completed');
    expect(stage.details['diamond_qc_completed']).toBe('2026-11-23');
  });
  it('keeps Diamond and Jewelry default fields independent', () => {
    expect(schemaForStage('diamond', stage).fields.map(f => f.key)).toEqual(['diamond_qc_completed']);
    expect(schemaForStage('jewellery', stage).fields.map(f => f.key)).toEqual(['qc_completed', 'recheck_required', 'photos_uploaded', 'customer_approved']);
  });
  it('reorders stage and field identities without dropping their data', () => {
    const fields = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];
    expect(moveItem(fields, 0, 1)).toEqual([fields[1], fields[0]]);
    expect(moveItem(fields, 0, -1)).toEqual(fields);
    expect(fields[0]?.key).toBe('a');
  });
  it('accepts blank descriptive values and every supported field type', () => {
    expect(workflowDefinition.parse([{ key: 'custom', name: '', description: '', fields: ['checkbox', 'text', 'number', 'date', 'textarea'].map(type => ({ key: type, type, label: '' })) }])[0]?.fields).toHaveLength(5);
  });
  it('rejects duplicate stage and field identities', () => {
    const s = { key: 'a', name: '', description: '', fields: [] };
    expect(() => workflowDefinition.parse([s, s])).toThrow();
    expect(() => workflowDefinition.parse([{ ...s, fields: [{ key: 'x', label: '', type: 'text' }, { key: 'x', label: '', type: 'text' }] }])).toThrow();
  });
  it('allows an omitted payment amount as an unconfirmed zero-value draft', () => {
    expect(optionalPaymentAmount('')).toBe(0);
    expect(optionalPaymentAmount('  ')).toBe(0);
    expect(optionalPaymentAmount('1,250.50')).toBe(1250.5);
    expect(() => optionalPaymentAmount('-1')).toThrow();
    expect(() => optionalPaymentAmount('not a number')).toThrow();
  });
});