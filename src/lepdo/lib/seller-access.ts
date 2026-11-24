import type { Role } from './types';

export type SellerStatus = 'pending' | 'approved' | 'rejected';

export function accountAccess(role: Role, active: boolean, sellerStatus?: SellerStatus | null) {
  const enabled = active && (role !== 'seller' || sellerStatus === 'approved');
  return {
    isStaff: enabled && ['admin', 'team', 'seller'].includes(role),
    isAdmin: enabled && role === 'admin',
    isOperator: enabled && (role === 'admin' || role === 'seller'),
    canManageSellers: enabled && role === 'admin',
    canAccessAccountSettings: enabled && role !== 'seller',
  };
}