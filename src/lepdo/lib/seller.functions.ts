import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { sellerAuthActivation, validateSellerDeletion, validateSellerEdit, validateSellerRegistration } from './seller-management';

export const registerSeller = createServerFn({ method: 'POST' })
  .inputValidator(validateSellerRegistration)
  .handler(async ({ data }) => {
    const { forwardAccountAction } = await import('./account-actions.server');
    const remote = await forwardAccountAction<{ pending: boolean }>('registerSeller', data);
    if (remote.forwarded) return remote.result;
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
    const { data: allowed, error: roleError } = await context.supabase.rpc('is_admin');
    if (roleError || !allowed) throw new Error('Administrators only.');
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
    const { data: allowed, error: roleError } = await context.supabase.rpc('is_admin');
    if (roleError || !allowed) throw new Error('Administrators only.');
    const { forwardAccountAction } = await import('./account-actions.server');
    const remote = await forwardAccountAction<{ saved: boolean }>('manageSeller', data);
    if (remote.forwarded) return remote.result;
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    // Check privileged access before committing a seller status change.
    const { error: accessError } = await admin.auth.admin.getUserById(data.user_id);
    if (accessError) throw new Error('Could not check seller account access. No changes were saved.');
    const { error } = await context.supabase.rpc('admin_manage_seller', {
      p_user_id: data.user_id, p_full_name: data.full_name, p_phone: data.phone,
      p_status: data.status, p_active: data.is_active,
    });
    if (error) throw new Error(error.message);
    const { error: authError } = await admin.auth.admin.updateUserById(data.user_id, sellerAuthActivation(data.status, data.is_active));
    if (authError) throw new Error(`Seller saved, but login access could not be updated: ${authError.message}. Save again to retry.`);
    return { saved: true };
  });

export const deleteSellerPermanently = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSellerDeletion)
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc('is_admin');
    if (roleError || !allowed || data.user_id === context.userId) throw new Error('Administrators only.');
    const { forwardAccountAction } = await import('./account-actions.server');
    const remote = await forwardAccountAction<{ deleted: boolean }>('deleteSeller', data);
    if (remote.forwarded) return remote.result;
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const { error: accessError } = await admin.auth.admin.getUserById(data.user_id);
    if (accessError) throw new Error('Could not check seller account access. No changes were saved.');
    const { data: rows, error: directoryError } = await context.supabase.rpc('admin_seller_directory');
    const seller = rows?.find(row => row.user_id === data.user_id);
    if (directoryError || !seller) throw new Error('Seller not found.');
    const { error } = await context.supabase.rpc('admin_manage_seller', {
      p_user_id: seller.user_id, p_full_name: seller.full_name, p_phone: seller.phone ?? '', p_status: seller.status, p_active: false,
    });
    if (error) throw new Error(error.message);
    const { error: banError } = await admin.auth.admin.updateUserById(data.user_id, { ban_duration: '876000h' });
    if (banError) throw new Error('Seller access revoked, but account deletion could not start. Retry deletion.');
    const { error: ownershipError } = await admin.rpc('release_seller_file_ownership', { p_user_id: data.user_id });
    if (ownershipError) throw new Error('Seller access revoked, but files could not be preserved for deletion. Retry deletion.');
    // Auth deletes the profile, role and request. Business references point to
    // name-only history instead, so no work, transactions or files are deleted.
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user_id);
    if (deleteError) throw new Error(`Seller access revoked, but permanent deletion failed: ${deleteError.message}`);
    return { deleted: true };
  });
