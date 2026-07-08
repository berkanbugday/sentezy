import { z } from "zod";

/**
 * Zod schemas for all web forms. Pair with react-hook-form via `zodResolver`.
 * Keep every form's validation here so it's consistent and reusable.
 */

export const loginSchema = z.object({
  email: z.string().min(1, "E-posta gerekli").email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Adını gir"),
});
export type SignupValues = z.infer<typeof signupSchema>;
