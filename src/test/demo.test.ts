import { describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lepdo/lib/demo';

describe('Requested demo accounts', () => {
  it('provides the requested admin account', () => {
    expect(DEMO_ACCOUNTS.find((account) => account.role === 'admin')?.email).toBe('admin@lepdo.com');
  });
  it('provides the requested executive account', () => {
    expect(DEMO_ACCOUNTS.find((account) => account.role === 'team')?.email).toBe('executive@lepdo.com');
  });
  it('provides the requested customer account', () => {
    expect(DEMO_ACCOUNTS.find((account) => account.role === 'customer')?.email).toBe('customer@lepdo.com');
  });
  it('uses the requested shared demo password', () => {
    expect(DEMO_PASSWORD).toBe('Lepdo#2026');
  });
});