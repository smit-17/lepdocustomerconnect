import type { Role } from './types';

export type SellerStatus = 'pending' | 'approved' | 'rejected';

export function directoryRoleVisible(role: Role, superAdmin: boolean, administratorsOnly = false) {
  if (administratorsOnly) return superAdmin && role === 'admin';
  return ['admin', 'team', 'seller'].includes(role) || (superAdmin && role === 'super_admin');
}

export function accountAccess(role: Role, active: boolean, sellerStatus?: SellerStatus | null) {
  const enabled = active && (role !== 'seller' || sellerStatus === 'approved');
  return {
    isStaff: enabled && ['super_admin', 'admin', 'team', 'seller'].includes(role),
    isSuperAdmin: enabled && role === 'super_admin',
    isAdmin: enabled && (role === 'super_admin' || role === 'admin'),
    isOperator: enabled && ['super_admin', 'admin', 'seller'].includes(role),
    canManageSellers: enabled && role === 'super_admin',
    canAccessAccountSettings: enabled && role !== 'seller',
  };
}