import { describe, expect, it } from 'vitest';
import { passwordChangeError } from '@/lepdo/lib/account';

describe('Account password changes', () => {
  it('requires the current password for signed-in changes', () => {
    expect(passwordChangeError('', 'new-example-pass', 'new-example-pass')).toBe('Enter your current password.');
  });
  it('rejects mismatched confirmation', () => {
    expect(passwordChangeError('old-example-pass', 'new-example-pass', 'different')).toBe('Passwords do not match.');
  });
  it('rejects new passwords shorter than eight characters', () => {
    expect(passwordChangeError('old-example-pass', 'short', 'short')).toBe('Use at least 8 characters.');
  });
  it('accepts a confirmed password with the current password', () => {
    expect(passwordChangeError('old-example-pass', 'new-example-pass', 'new-example-pass')).toBeNull();
  });
});