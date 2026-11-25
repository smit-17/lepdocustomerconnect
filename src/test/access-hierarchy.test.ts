import { describe, expect, it } from 'vitest';
import { accountAccess, directoryRoleVisible } from '@/lepdo/lib/seller-access';

describe('Workspace access hierarchy', () => {
  it('gives active Super Admin complete management access', () => {
    expect(accountAccess('super_admin', true)).toMatchObject({ isStaff: true, isAdmin: true, isOperator: true, isSuperAdmin: true, canManageSellers: true, canAccessAccountSettings: true });
  });
  it('retains Admin operational access without Super Admin or seller-request access', () => {
    expect(accountAccess('admin', true)).toMatchObject({ isAdmin: true, isOperator: true, isSuperAdmin: false, canManageSellers: false, canAccessAccountSettings: true });
  });
  it('does not give executives Super Admin access', () => {
    expect(accountAccess('team', true).isSuperAdmin).toBe(false);
    expect(accountAccess('seller', true, 'approved').isSuperAdmin).toBe(false);
  });
  it('blocks deactivated Super Admin accounts', () => {
    expect(accountAccess('super_admin', false).canManageSellers).toBe(false);
  });
  it('lets Super Admin manage Admin records independently of its own profile', () => {
    expect(directoryRoleVisible('admin', true, true)).toBe(true);
    expect(directoryRoleVisible('super_admin', true, true)).toBe(false);
    expect(directoryRoleVisible('seller', true, true)).toBe(false);
    expect(directoryRoleVisible('admin', false, true)).toBe(false);
  });
  it('keeps all staff records visible to Super Admin', () => {
    for (const role of ['super_admin', 'admin', 'team', 'seller'] as const) {
      expect(directoryRoleVisible(role, true)).toBe(true);
    }
    expect(directoryRoleVisible('customer', true)).toBe(false);
  });
});