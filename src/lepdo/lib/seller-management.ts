import type { SellerStatus } from './seller-access';

export const SELLER_VERIFICATION_URL = 'https://lepdocustomerconnect.vercel.app/login';

export interface SellerEdit {
  user_id: string;
  full_name: string;
  phone: string;
  status: SellerStatus;
  is_active: boolean;
}

export interface SellerRegistration { full_name: string; email: string; password: string }

export function validateSellerRegistration(input: SellerRegistration): SellerRegistration {
  const full_name = String(input?.full_name ?? '').trim();
  const email = String(input?.email ?? '').trim().toLowerCase();
  if (!full_name || full_name.length > 120) throw new Error('Enter your name (up to 120 characters).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email.');
  if (typeof input?.password !== 'string' || input.password.length < 8 || input.password.length > 128) throw new Error('Use a password between 8 and 128 characters.');
  return { full_name, email, password: input.password };
}

export function sellerAuthActivation(status: SellerStatus, active: boolean) {
  return { email_confirm: true, ban_duration: status === 'approved' && active ? 'none' : '876000h' };
}

export function validateSellerDeletion(input: { user_id: string; confirmation: string }) {
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.user_id) || input.confirmation !== 'DELETE PERMANENTLY') throw new Error('Confirm permanent seller deletion.');
  return input;
}

export function validateSellerEdit(input: SellerEdit): SellerEdit {
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.user_id)) throw new Error('Invalid seller.');
  if (!['pending', 'approved', 'rejected'].includes(input.status)) throw new Error('Invalid approval status.');
  if (typeof input.is_active !== 'boolean' || (input.is_active && input.status !== 'approved')) throw new Error('Only approved sellers can be active.');
  const full_name = String(input.full_name ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  if (!full_name || full_name.length > 120 || phone.length > 50) throw new Error('Enter a name up to 120 characters and phone up to 50 characters.');
  return { ...input, full_name, phone };
}