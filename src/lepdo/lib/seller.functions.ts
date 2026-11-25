import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { validateSellerDeletion, validateSellerEdit, validateSellerRegistration } from './seller-management';

export const registerSeller = createServerFn({ method: 'POST' })
  .inputValidator(validateSellerRegistration)
  .handler(async ({ data }) => {
    if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) {
      // Self-hosted (Vercel): ordinary signup; the account stays pending and
      // cannot sign in until an admin approval activates it in the database.
      const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
      const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
      if (!url || !key) throw new Error('Registration is unavailable. Please try again later.');
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await client.auth.signUp({ email: data.email, password: data.password, options: { data: { full_name: data.full_name, seller_signup: 'true' } } });
      if (error) throw new Error('Registration could not be completed. If you already registered, sign in after admin approval.');
      return { pending: true };
    }
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    // The caller cannot select a role or activate an account. The signup trigger
    // creates an inactive seller and pending request; Auth also blocks login.
    const { data: permitted, error: limitError } = await admin.rpc('consume_seller_signup', {
      p_bucket: getRequestHeader('cf-connecting-ip') ?? 'shared-registration',
    });
    if (limitError || !permitted) throw new Error('Too many registrations. Please try again later.');
    const { error } = await admin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      ban_duration: '876000h', user_metadata: { full_name: data.full_name, seller_signup: 'true' },
    });
    if (error) throw new Error('Registration could not be completed. If you already registered, sign in after admin approval.');
    return { pending: true };
  });

export const sellerDirectory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc('is_super_admin');
    if (roleError || !allowed) throw new Error('Super Admin only.');
    const { data: rows, error } = await context.supabase.rpc('admin_seller_directory');
    if (error) throw new Error(error.message);
    // Listing is read-only. Account activation belongs to the explicit save
    // action, not a page load that requires privileged Auth credentials.
    return rows ?? [];
  });

export const manageSeller = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSellerEdit)
  .handler(async ({ data, context }) => {
    // The admin-checked RPC updates the request, profile and login access together.
    const { error } = await context.supabase.rpc('admin_manage_seller', {
      p_user_id: data.user_id, p_full_name: data.full_name, p_phone: data.phone,
      p_status: data.status, p_active: data.is_active,
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const deleteSellerPermanently = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSellerDeletion)
  .handler(async ({ data, context }) => {
    // Removes only the login account, profile, role and request; work, files
    // and historical names stay through profile_history.
    const { error } = await context.supabase.rpc('admin_delete_seller', { p_user_id: data.user_id });
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
