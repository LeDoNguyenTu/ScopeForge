export function validateNewPassword(password: string, confirmation: string): string | null {
  if (!password) return "Enter a new password.";
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 128) return "Use no more than 128 characters.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}
