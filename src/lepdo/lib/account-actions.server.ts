import { createClient } from '@supabase/supabase-js';
import { getRequest } from '@tanstack/react-start/server';
import { ACCOUNT_ACTIONS_PATH, ACCOUNT_ACTIONS_URL, accountActionSchema, type AccountAction } from './account-actions';

/** Self-hosted servers delegate privileged work; no private credential leaves Cloud. */
export async function forwardAccountAction<Result>(action: AccountAction['action'], data: unknown): Promise<{ forwarded: false } | { forwarded: true; result: Result }> {
  if (process.env['SUPABASE_SERVICE_ROLE_KEY']) return { forwarded: false };
  const request = getRequest();
  if (new URL(request.url).pathname === ACCOUNT_ACTIONS_PATH) {
    throw new Error('Account management is unavailable. Publish the Lovable Cloud connection before retrying.');
  }
  const payload = accountActionSchema.parse({ action, data });
  const authorization = request.headers.get('authorization');
  if (action !== 'registerSeller' && !authorization?.startsWith('Bearer ')) throw new Error('Please sign in again.');
  let response: Response;
  try {
    response = await fetch(ACCOUNT_ACTIONS_URL, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach account management. Please try again later.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Account management is not live yet. Publish the Lovable Cloud connection and redeploy Vercel.');
  }
  const body = await response.json() as { result?: Result; error?: string };
  if (!response.ok || !('result' in body)) throw new Error(body.error || 'Account action failed. Please retry.');
  return { forwarded: true, result: body.result as Result };
}

export async function handleAccountAction(request: Request): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (Number(request.headers.get('content-length') ?? 0) > 16384) return reply({ error: 'Request too large.' }, 413);
  const text = await request.text();
  if (text.length > 16384) return reply({ error: 'Request too large.' }, 413);
  let payload: AccountAction;
  try { payload = accountActionSchema.parse(JSON.parse(text)); }
  catch { return reply({ error: 'Invalid account action.' }, 400); }
  if (payload.action !== 'registerSeller') {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Please sign in again.' }, 401);
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return reply({ error: 'Account management is unavailable.' }, 503);
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !data.user) return reply({ error: 'Please sign in again.' }, 401);
  }
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) return reply({ error: 'Account management is unavailable. Publish the Lovable Cloud connection.' }, 503);
  try {
    let result: unknown;
    // Existing functions recheck caller roles and ownership; this endpoint is
    // not an alternate authorization path, and never accepts a caller ID.
    switch (payload.action) {
      case 'registerSeller': {
        const { registerSeller } = await import('./seller.functions');
        result = await registerSeller({ data: payload.data }); break;
      }
      case 'manageSeller': {
        const { manageSeller } = await import('./seller.functions');
        result = await manageSeller({ data: payload.data }); break;
      }
      case 'deleteSeller': {
        const { deleteSellerPermanently } = await import('./seller.functions');
        result = await deleteSellerPermanently({ data: payload.data }); break;
      }
      case 'inviteUser': {
        const { inviteUser } = await import('./invite.functions');
        result = await inviteUser({ data: payload.data }); break;
      }
      case 'changeTeamEmail': {
        const { changeTeamEmail } = await import('./invite.functions');
        result = await changeTeamEmail({ data: payload.data }); break;
      }
      case 'deleteHistory': {
        const { deleteOrderHistory } = await import('./history.functions');
        result = await deleteOrderHistory({ data: payload.data }); break;
      }
    }
    return reply({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account action failed. Please retry.';
    return reply({ error: /environment variable|SUPABASE_|service.role/i.test(message) ? 'Account management is unavailable.' : message }, 400);
  }
}