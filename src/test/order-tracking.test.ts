import { describe, expect, it } from 'vitest';
import { customerTrackingUrl, trackingOrder, trackingToken } from '@/lepdo/lib/tracking';

describe('Public order tracking', () => {
  it('always shares the live Vercel tracking address, never the preview origin', () => {
    expect(customerTrackingUrl('a'.repeat(64))).toBe(`https://lepdocustomerconnect.vercel.app/portal-share/${'a'.repeat(64)}`);
    expect(() => customerTrackingUrl('../admin')).toThrow();
  });
  it('requires a secure 64-character link rather than an order ID', () => {
    expect(trackingToken.safeParse('a'.repeat(64)).success).toBe(true);
    expect(trackingToken.safeParse('a'.repeat(63)).success).toBe(false);
    expect(trackingToken.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(false);
  });
  it('limits the customer view to order status and timeline, excluding internal data', () => {
    const result = trackingOrder.parse({ reference: 'LPD-2026-0004', status: 'active', current_stage_name: 'Proforma Invoice', progress_pct: 0,
      notes: 'Private', customer_email: 'private@example.com', amount_received: 500,
      stages: [{ stage_key: 'proforma', name: 'Proforma Invoice', status: 'in_progress', details: { internal: 'Private' } }],
    });
    expect(Object.keys(result).sort()).toEqual(['current_stage_name', 'progress_pct', 'reference', 'stages', 'status']);
    expect(Object.keys(result.stages[0] ?? {}).sort()).toEqual(['name', 'stage_key', 'status']);
  });
});