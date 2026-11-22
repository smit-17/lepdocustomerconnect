import { describe, expect, it, vi } from 'vitest';
import { removeHistory } from '@/lepdo/lib/history.server';

describe('Order history deletion', () => {
  it('rejects non-admin callers without deleting anything', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const files = vi.fn();
    await expect(removeHistory({ rpc }, files, 'order-id', '')).rejects.toThrow('Only administrators');
    expect(rpc.mock.calls).toEqual([['is_admin']]);
    expect(files).not.toHaveBeenCalled();
  });
  it('requires explicit confirmation for a full reset', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(removeHistory({ rpc }, vi.fn(), null, '')).rejects.toThrow('RESET HISTORY');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('deletes only the requested order and cleans only its order files', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: { deleted_count: 1, paths: ['order-id/invoice.pdf'] }, error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ remove }));
    expect(await removeHistory({ rpc }, async () => ({ storage: { from } }), 'order-id', '')).toEqual({ deletedCount: 1, cleanupPending: false });
    expect(rpc).toHaveBeenLastCalledWith('admin_delete_order_history', { p_order_id: 'order-id', p_confirmation: '' });
    expect(from).toHaveBeenCalledExactlyOnceWith('order-documents');
    expect(remove).toHaveBeenCalledExactlyOnceWith(['order-id/invoice.pdf']);
  });
  it('resets order history without accessing customer, KYC, consent, account or settings stores', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: { deleted_count: 3, paths: [] }, error: null });
    const files = vi.fn();
    expect(await removeHistory({ rpc }, files, null, 'RESET HISTORY')).toEqual({ deletedCount: 3, cleanupPending: false });
    expect(rpc.mock.calls).toEqual([['is_admin'], ['admin_delete_order_history', { p_order_id: null, p_confirmation: 'RESET HISTORY' }]]);
    expect(files).not.toHaveBeenCalled();
  });
});