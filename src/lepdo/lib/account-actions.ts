import { z } from 'zod';

export const ACCOUNT_ACTIONS_PATH = '/api/public/account-actions';
export const ACCOUNT_ACTIONS_URL = `https://facet-flow-workspace.lovable.app${ACCOUNT_ACTIONS_PATH}`;

const email = z.string().trim().email().max(254);
const name = z.string().trim().min(1).max(120);
const redirect = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.origin === 'https://lepdocustomerconnect.vercel.app' && url.pathname === '/set-password';
}, 'Use the customer website password link.').optional();

export const accountActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('registerSeller'), data: z.object({ full_name: name, email, password: z.string().min(8).max(128) }) }),
  z.object({ action: z.literal('manageSeller'), data: z.object({ user_id: z.string().uuid(), full_name: name, phone: z.string().max(50), status: z.enum(['pending', 'approved', 'rejected']), is_active: z.boolean() }) }),
  z.object({ action: z.literal('deleteSeller'), data: z.object({ user_id: z.string().uuid(), confirmation: z.literal('DELETE PERMANENTLY') }) }),
  z.object({ action: z.literal('inviteUser'), data: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('customer'), customer_id: z.string().uuid(), email: email.optional(), full_name: name.optional(), redirect_to: redirect }),
    z.object({ kind: z.literal('team'), email, full_name: name, phone: z.string().max(40).optional(), role: z.enum(['admin', 'team']), redirect_to: redirect }),
  ]) }),
  z.object({ action: z.literal('changeTeamEmail'), data: z.object({ user_id: z.string().uuid(), email }) }),
  z.object({ action: z.literal('deleteHistory'), data: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('order'), orderId: z.string().uuid() }),
    z.object({ kind: z.literal('reset'), confirmation: z.literal('RESET HISTORY') }),
  ]) }),
]);

export type AccountAction = z.infer<typeof accountActionSchema>;