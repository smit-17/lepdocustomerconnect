import { describe, expect, it } from 'vitest';
import { orderActionsLocked } from '@/lepdo/lib/workflows';

describe('Order lifecycle action visibility', () => {
  it('locks Reopen, Cancel and Delete after marking an order completed', () => {
    expect(orderActionsLocked('completed', [])).toBe(true);
    expect(orderActionsLocked('active', [])).toBe(false);
    expect(orderActionsLocked('cancelled', [])).toBe(false);
  });
  it('locks actions when Handed Over to Shipping Company is completed, independently of the current step', () => {
    expect(orderActionsLocked('active', [{ stage_key: 'shipped', status: 'completed' }, { stage_key: 'tracking', status: 'in_progress' }])).toBe(true);
    expect(orderActionsLocked('active', [{ stage_key: 'shipped', status: 'in_progress' }])).toBe(false);
    expect(orderActionsLocked('active', [{ stage_key: 'ready_to_ship', status: 'completed' }])).toBe(false);
  });
  it('hides actions while stage information is unavailable', () => {
    expect(orderActionsLocked('active')).toBe(true);
  });
});