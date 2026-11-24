import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const deleteOrderHistory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('order'), orderId: z.string().uuid() }),
    z.object({ kind: z.literal('reset'), confirmation: z.literal('RESET HISTORY') }),
  ]).parse(input))
  .handler(async ({ data, context }) => {
    const { removeHistory } = await import('./history.server');
    return removeHistory({ rpc: (name, args) => name === 'is_admin' || name === 'is_operator'
      ? context.supabase.rpc(name)
      : context.supabase.rpc('admin_delete_order_history', {
        ...(typeof args?.['p_order_id'] === 'string' ? { p_order_id: args['p_order_id'] } : {}),
        p_confirmation: String(args?.['p_confirmation'] ?? ''),
      }) }, async () => {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      return supabaseAdmin;
    }, data.kind === 'order' ? data.orderId : null, data.kind === 'reset' ? data.confirmation : '');
  });