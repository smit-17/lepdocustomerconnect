import { describe, expect, it } from 'vitest';
import { SELLER_VERIFICATION_URL, sellerAuthActivation, validateSellerDeletion, validateSellerRegistration, validateSellerEdit, type SellerEdit } from '@/lepdo/lib/seller-management';
import { accountAccess } from '@/lepdo/lib/seller-access';

const seller: SellerEdit = { user_id: '00000000-0000-4000-8000-000000000001', full_name: 'Seller', phone: '', status: 'approved', is_active: true };
describe('Seller management rules', () => {
  it('registers with only name email and password', () => {
    expect(validateSellerRegistration({ full_name: ' Seller ', email: 'Seller@example.com', password: 'Password#2026' })).toEqual({ full_name: 'Seller', email: 'seller@example.com', password: 'Password#2026' });
  });
  it('activates approved sellers without mailbox confirmation', () => {
    expect(sellerAuthActivation('approved', true)).toEqual({ email_confirm: true, ban_duration: 'none' });
  });
  it('bans pending seller login', () => {
    expect(sellerAuthActivation('pending', false).ban_duration).toBe('876000h');
  });
  it('bans rejected seller login', () => {
    expect(sellerAuthActivation('rejected', false).ban_duration).toBe('876000h');
  });
  it('bans deactivated seller login', () => {
    expect(sellerAuthActivation('approved', false).ban_duration).toBe('876000h');
  });
  it('requires explicit confirmation for permanent deletion', () => {
    expect(() => validateSellerDeletion({ user_id: seller.user_id, confirmation: 'Deactivate' })).toThrow('Confirm permanent');
    expect(validateSellerDeletion({ user_id: seller.user_id, confirmation: 'DELETE PERMANENTLY' }).user_id).toBe(seller.user_id);
  });
  it('returns verification links to the public live login', () => {
    expect(SELLER_VERIFICATION_URL).toBe('https://lepdocustomerconnect.vercel.app/login');
  });
  it('allows editing approved sellers with optional phone', () => {
    expect(validateSellerEdit(seller)).toEqual(seller);
  });
  it('cannot activate pending sellers', () => {
    expect(() => validateSellerEdit({ ...seller, status: 'pending' })).toThrow('Only approved');
  });
  it('cannot activate rejected sellers', () => {
    expect(() => validateSellerEdit({ ...seller, status: 'rejected' })).toThrow('Only approved');
  });
  it('deactivation revokes dashboard access without changing approval history', () => {
    const saved = validateSellerEdit({ ...seller, is_active: false });
    expect(saved.status).toBe('approved');
    expect(accountAccess('seller', saved.is_active, saved.status).isStaff).toBe(false);
  });
});