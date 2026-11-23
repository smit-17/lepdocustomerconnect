export function passwordChangeError(current: string, password: string, confirm: string): string | null {
  if (!current) return 'Enter your current password.';
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}