// Sends invitation emails for customers (any team member with access) and
// team members (admins only). Server-only: the privileged client is loaded
// inside the handler after the caller has been verified.
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type InviteInput =
  | { kind: 'customer'; customer_id: string; email?: string; full_name?: string; redirect_to?: string }
  | { kind: 'team'; email: string; full_name: string; phone?: string; role: 'team' | 'admin'; redirect_to?: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const inviteUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => {
    if (!input || (input.kind !== 'customer' && input.kind !== 'team')) throw new Error('Unknown invitation type.');
    return input;
  })
  .handler(async ({ data: body, context }) => {
    const { supabase: asCaller, userId } = context;
    const { data: caller } = await asCaller.from('profiles').select('id, role, is_active').eq('id', userId).single();
    if (!caller || !caller.is_active || !['admin', 'team'].includes(caller.role)) {
      throw new Error('Only LEPDO team members can send invitations.');
    }

    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const redirectTo =
      typeof body.redirect_to === 'string' && /^https?:\/\/[^\s]+\/set-password$/.test(body.redirect_to) ? body.redirect_to : undefined;
    let email = String(body.email || '').trim().toLowerCase();
    let fullName = String(body.full_name || '').trim().slice(0, 120);
    const phone = body.kind === 'team' ? String((body as { phone?: string }).phone || '').trim().slice(0, 40) : '';
    let role: 'customer' | 'team' | 'admin';
    let customerId: string | null = null;

    if (body.kind === 'customer') {
      customerId = String(body.customer_id || '');
      const { data: canAccess, error } = await asCaller.rpc('staff_can_access_customer', { cid: customerId });
      if (error || !canAccess) throw new Error('You do not have access to this customer.');
      const { data: customer } = await admin.from('customers').select('id, name, email, contact_person').eq('id', customerId).single();
      if (!customer) throw new Error('Customer not found.');
      email = email || customer.email;
      fullName = fullName || customer.contact_person || customer.name;
      role = 'customer';
    } else {
      if (caller.role !== 'admin') throw new Error('Only administrators can invite team members.');
      role = body.role === 'admin' ? 'admin' : 'team';
    }
    if (!EMAIL_RE.test(email)) throw new Error('A valid email address is required.');

    const { data: existing } = await admin.from('profiles').select('id, role, customer_id').ilike('email', email).maybeSingle();
    if (existing) {
      if (role === 'customer' && existing.role !== 'customer')
        throw new Error('This email belongs to a LEPDO team account and cannot be used for a customer.');
      if (role === 'customer' && existing.customer_id && existing.customer_id !== customerId)
        throw new Error('This email is already linked to another customer.');
      if (role !== 'customer' && existing.role === 'customer' && existing.customer_id)
        throw new Error('This email is already used by a customer portal account.');
    }

    let status: 'invited' | 'resent' = 'invited';
    let invitedId = existing?.id as string | undefined;
    const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName } });
    if (inv.error) {
      if (!/already (been )?registered|already exists/i.test(inv.error.message)) throw new Error(inv.error.message);
      const reset = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (reset.error) throw new Error(reset.error.message);
      status = 'resent';
      if (!invitedId) {
        const { data: p } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle();
        invitedId = p?.id;
      }
    } else {
      invitedId = inv.data.user?.id;
    }
    if (!invitedId) throw new Error('Could not create the user account.');

    const patch: { role: string; is_active: boolean; customer_id: string | null; full_name?: string; phone?: string } = {
      role,
      is_active: true,
      customer_id: role === 'customer' ? customerId : null,
    };
    if (fullName && (!existing || status === 'invited')) patch.full_name = fullName;
    if (phone && (!existing || status === 'invited')) patch.phone = phone;
    const { error: upErr } = await admin.from('profiles').upsert({ id: invitedId, email, ...patch }, { onConflict: 'id' });
    if (upErr) throw new Error(upErr.message);

    if (role === 'customer' && customerId) {
      await admin.from('customers').update({ portal_invited_at: new Date().toISOString() }).eq('id', customerId);
    }
    return { ok: true, status, email };
  });

/** Admin-only: change a team member's sign-in email and matching directory address. */
export const changeTeamEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; email: string }) => input)
  .handler(async ({ data: body, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc('is_admin');
    if (roleError || !allowed) throw new Error('Only administrators can change email addresses.');
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error('A valid email address is required.');
    const { data: target } = await admin.from('profiles').select('id, role, email').eq('id', body.user_id).single();
    if (!target || target.role === 'customer') throw new Error('Team member not found.');
    if (target.email.toLowerCase() === email) return { ok: true };
    const { data: clash } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (clash) throw new Error('This email is already used by another account.');
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { email, email_confirm: true });
    if (error) throw new Error(error.message);
    const { error: profileError } = await admin.from('profiles').update({ email }).eq('id', body.user_id);
    if (profileError) throw new Error(profileError.message);
    return { ok: true };
  });
