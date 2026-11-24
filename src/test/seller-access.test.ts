import { describe, expect, it } from 'vitest';
import { accountAccess } from '@/lepdo/lib/seller-access';

describe('Seller approval and permissions', () => {
  it('blocks pending sellers even if the active flag is true', () => {
    expect(accountAccess('seller', true, 'pending').isStaff).toBe(false);
  });
  it('blocks rejected sellers', () => {
    expect(accountAccess('seller', true, 'rejected').isStaff).toBe(false);
  });
  it('allows approved active sellers to use admin operational features', () => {
    expect(accountAccess('seller', true, 'approved').isOperator).toBe(true);
  });
  it('blocks deactivated approved sellers', () => {
    expect(accountAccess('seller', false, 'approved').isStaff).toBe(false);
  });
  it('never gives sellers request management', () => {
    expect(accountAccess('seller', true, 'approved').canManageSellers).toBe(false);
  });
  it('never gives sellers account settings or admin permissions', () => {
    const access = accountAccess('seller', true, 'approved');
    expect(access.canAccessAccountSettings).toBe(false);
    expect(access.isAdmin).toBe(false);
  });
  it('keeps admin management permissions', () => {
    expect(accountAccess('admin', true).canManageSellers).toBe(true);
  });
  it('keeps customer and executive permissions unchanged', () => {
    expect(accountAccess('customer', true).isStaff).toBe(false);
    expect(accountAccess('team', true).isStaff).toBe(true);
    expect(accountAccess('team', true).isOperator).toBe(false);
  });
});