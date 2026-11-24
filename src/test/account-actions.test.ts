import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_ACTIONS_URL, accountActionSchema, type AccountAction } from '../lepdo/lib/account-actions';

const requestState = vi.hoisted(() => ({ request: new Request('https://lepdocustomerconnect.vercel.app/action') }));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => requestState.request }));
import { forwardAccountAction, handleAccountAction } from '../lepdo/lib/account-actions.server';

const id = '11111111-1111-4111-8111-111111111111';
const actions: AccountAction[] = [
  { action: 'registerSeller', data: { full_name: 'Seller Check', email: 'seller@example.com', password: 'test-password-only' } },
  { action: 'manageSeller', data: { user_id: id, full_name: 'Seller Check', phone: '', status: 'approved', is_active: true } },
  { action: 'deleteSeller', data: { user_id: id, confirmation: 'DELETE PERMANENTLY' } },
  { action: 'inviteUser', data: { kind: 'customer', customer_id: id } },
  { action: 'inviteUser', data: { kind: 'team', email: 'team@example.com', full_name: 'Team Check', role: 'team' } },
  { action: 'changeTeamEmail', data: { user_id: id, email: 'team@example.com' } },
  { action: 'deleteHistory', data: { kind: 'order', orderId: id } },
  { action: 'deleteHistory', data: { kind: 'reset', confirmation: 'RESET HISTORY' } },
];

describe('Cloud account action forwarding', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    requestState.request = new Request('https://lepdocustomerconnect.vercel.app/action', {
      headers: { Authorization: 'Bearer test-session', Cookie: 'must-not-forward=1' },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it.each(actions)('forwards $action only to the fixed Cloud endpoint', async ({ action, data }) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ result: { done: true } }));
    vi.stubGlobal('fetch', fetch);
    expect(await forwardAccountAction(action, data)).toEqual({ forwarded: true, result: { done: true } });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(ACCOUNT_ACTIONS_URL, expect.objectContaining({
      method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session' },
      body: JSON.stringify(accountActionSchema.parse({ action, data })),
    }));
  });

  it('keeps Cloud operations local without forwarding its private credentials', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-placeholder-not-a-real-key');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await forwardAccountAction('registerSeller', actions[0]?.data)).toEqual({ forwarded: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects protected actions without a session before forwarding', async () => {
    requestState.request = new Request('https://lepdocustomerconnect.vercel.app/action');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(forwardAccountAction('deleteSeller', { user_id: id, confirmation: 'DELETE PERMANENTLY' })).rejects.toThrow('sign in');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not loop or perform work when Cloud is missing its own credentials', async () => {
    requestState.request = new Request(ACCOUNT_ACTIONS_URL);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(forwardAccountAction('registerSeller', actions[0]?.data)).rejects.toThrow('unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports an unpublished endpoint without treating it as a saved action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));
    await expect(forwardAccountAction('registerSeller', actions[0]?.data)).rejects.toThrow('not live yet');
  });

  it('rejects missing deletion confirmation', () => {
    expect(accountActionSchema.safeParse({ action: 'deleteSeller', data: { user_id: id, confirmation: '' } }).success).toBe(false);
    expect(accountActionSchema.safeParse({ action: 'deleteHistory', data: { kind: 'reset', confirmation: '' } }).success).toBe(false);
  });

  it('rejects invitation links to another website', () => {
    expect(accountActionSchema.safeParse({ action: 'inviteUser', data: { kind: 'customer', customer_id: id, redirect_to: 'https://other.example/set-password' } }).success).toBe(false);
  });

  it('rejects unauthenticated protected endpoint requests', async () => {
    const response = await handleAccountAction(new Request(ACCOUNT_ACTIONS_URL, { method: 'POST', body: JSON.stringify(actions[2]) }));
    expect(response.status).toBe(401);
  });

  it('rejects unknown actions instead of exposing arbitrary Cloud operations', async () => {
    const response = await handleAccountAction(new Request(ACCOUNT_ACTIONS_URL, { method: 'POST', body: JSON.stringify({ action: 'promoteAdmin', data: {} }) }));
    expect(response.status).toBe(400);
  });
});