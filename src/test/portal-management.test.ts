import { describe, expect, it } from 'vitest';
import { journeyProgress } from '@/lepdo/lib/workflows';
import { KYC_MAX_BYTES, validateCustomerFile } from '@/lepdo/lib/portal-management';

describe('Customer order rules', () => {
  it('shows delivered orders as 100% even with legacy incomplete stages', () => {
    expect(journeyProgress([{ stage_key: 'delivered', status: 'upcoming' }], 'completed')).toBe(100);
  });
  it('excludes optional feedback from delivery progress', () => {
    expect(journeyProgress([{ stage_key: 'delivered', status: 'completed' }, { stage_key: 'feedback', status: 'upcoming' }])).toBe(100);
  });
  it('excludes non-applicable stages from progress', () => {
    expect(journeyProgress([{ stage_key: 'proforma', status: 'completed' }, { stage_key: 'bank_details', status: 'not_applicable' }, { stage_key: 'delivered', status: 'upcoming' }])).toBe(50);
  });
  it('accepts KYC files up to 10 MB and rejects larger files', () => {
    expect(() => validateCustomerFile({ size: 10 * 1024 * 1024, type: 'application/pdf' }, KYC_MAX_BYTES)).not.toThrow();
    expect(() => validateCustomerFile({ size: 10 * 1024 * 1024 + 1, type: 'application/pdf' }, KYC_MAX_BYTES)).toThrow();
  });
  it('rejects executable uploads', () => {
    expect(() => validateCustomerFile({ size: 100, type: 'application/javascript' }, KYC_MAX_BYTES)).toThrow();
  });
});
import { REJECTION_REASONS, docTypeForStage } from '@/lepdo/lib/workflows';
describe('order workflow v2', () => {
  it('final invoice step files documents as final invoices', () => { expect(docTypeForStage('final_invoice')).toBe('final_invoice'); });
  it('offers the five rejection reasons', () => { expect(REJECTION_REASONS).toEqual(['Design alteration needed', 'Dimensions mismatch', 'Stone setting revision', 'Finish defect', 'Other']); });
});
