import { describe, expect, it } from 'vitest';
import { canEditOrderSteps, moveStageIds, validateNewStageName } from '@/lepdo/lib/workflows';

describe('Uploaded order-step changes', () => {
  it('requires a trimmed new step name of 1 to 120 characters', () => {
    expect(validateNewStageName('  Inspection  ')).toBe('Inspection');
    expect(validateNewStageName('A')).toBe('A');
    expect(validateNewStageName('A'.repeat(120))).toHaveLength(120);
    expect(() => validateNewStageName('   ')).toThrow();
    expect(() => validateNewStageName('A'.repeat(121))).toThrow();
  });
  it('allows only administrators to edit steps', () => {
    expect(canEditOrderSteps(true, 'active')).toBe(true);
    expect(canEditOrderSteps(false, 'active')).toBe(false);
    expect(canEditOrderSteps(true, 'completed')).toBe(false);
    expect(canEditOrderSteps(true, 'cancelled')).toBe(false);
  });
  it('hides step editing as soon as any stage starts or completes with the default-off setting', () => {
    expect(canEditOrderSteps(true, 'active', [{ status: 'upcoming' }])).toBe(true);
    expect(canEditOrderSteps(true, 'active', [{ status: 'in_progress' }])).toBe(false);
    expect(canEditOrderSteps(true, 'active', [{ status: 'completed' }])).toBe(false);
    expect(canEditOrderSteps(true, 'active', [{ status: 'upcoming', details: { started: 'now' } }])).toBe(false);
  });
  it('restores editing of running orders only when the configuration switch is on', () => {
    expect(canEditOrderSteps(true, 'active', [{ status: 'in_progress' }], true)).toBe(true);
    expect(canEditOrderSteps(true, 'completed', [{ status: 'completed' }], true)).toBe(true);
    expect(canEditOrderSteps(false, 'active', [{ status: 'in_progress' }], true)).toBe(false);
    expect(canEditOrderSteps(true, 'cancelled', [], true)).toBe(false);
  });
  it('moves a step without losing or changing any stage IDs', () => {
    const ids = ['proforma', 'bank_details', 'payment_in_progress'];
    expect(moveStageIds(ids, 1, -1)).toEqual(['bank_details', 'proforma', 'payment_in_progress']);
    expect(moveStageIds(ids, 1, 1)).toEqual(['proforma', 'payment_in_progress', 'bank_details']);
    expect(ids).toEqual(['proforma', 'bank_details', 'payment_in_progress']);
  });
  it('does not move steps beyond the timeline boundaries', () => {
    expect(moveStageIds(['proforma', 'bank_details'], 0, -1)).toBeNull();
    expect(moveStageIds(['proforma', 'bank_details'], 1, 1)).toBeNull();
  });
});