/**
 * Generate a unique confirmation code for event registrations
 * Format: 8 characters, alphanumeric uppercase
 * Example: A3F9K2M7
 */
export function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate confirmation code format
 */
export function isValidConfirmationCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}
