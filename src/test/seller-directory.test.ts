import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({ getRequestHeader: vi.fn() }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => {
  throw new Error('Privileged account credentials must not be required to list sellers.');
});

import { sellerDirectory } from '../lepdo/lib/seller.functions';

// The builder mock exposes the actual handler with its middleware context.
const directory = sellerDirectory as unknown as (input: {
  context: { supabase: { rpc: ReturnType<typeof vi.fn> } };
}) => Promise<unknown>;

describe('seller directory read-only access', () => {
  const rpc = vi.fn();
  beforeEach(() => rpc.mockReset());

  it('loads existing approved sellers without privileged Auth access', async () => {
    const rows = [{ user_id: 'seller-1', status: 'approved', is_active: true }];
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: rows, error: null });
    await expect(directory({ context: { supabase: { rpc } } })).resolves.toEqual(rows);
    expect(rpc.mock.calls).toEqual([['is_admin'], ['admin_seller_directory']]);
  });

  it('rejects non-administrators before reading seller records', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(directory({ context: { supabase: { rpc } } })).rejects.toThrow('Administrators only.');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when there are no seller requests', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(directory({ context: { supabase: { rpc } } })).resolves.toEqual([]);
  });
});