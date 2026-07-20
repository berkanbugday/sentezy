/** Minimum password length. Matches the signup schema (schemas.ts) — the two must agree,
 *  or a password valid at signup could be rejected here, or vice versa. */
export const MIN_PASSWORD = 6;

export type PasswordError = "too_short" | "mismatch";

/** Validate a new-password + confirmation pair. Pure, so it is tested without a DOM.
 *  Order matters: check length before match, so "6 karakter" wins over "eşleşmiyor" while
 *  the user is still typing the first field. */
export function validateNewPassword(password: string, confirm: string): PasswordError | null {
  if (password.length < MIN_PASSWORD) return "too_short";
  if (password !== confirm) return "mismatch";
  return null;
}

export function passwordErrorMessage(e: PasswordError): string {
  if (e === "too_short") return `Şifre en az ${MIN_PASSWORD} karakter olmalı`;
  return "Şifreler eşleşmiyor";
}
