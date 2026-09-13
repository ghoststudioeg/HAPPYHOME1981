
export const SECURE_ADMIN_EMAILS = ['atito4031@gmail.com', 'musicusabest@gmail.com'];

/**
 * Checks if an email is in the pre-authorized admin list.
 * Normalizes casing and whitespace for robust matching.
 */
export function checkIsAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return SECURE_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized);
}
