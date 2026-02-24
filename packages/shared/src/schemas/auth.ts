import { z } from "zod";

const email = z.string().email("Invalid email");
const password = z.string().min(8, "Password must be at least 8 characters").max(128);

export const signupBody = z.object({
  email,
  password,
  name: z
    .string()
    .max(100)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});

export const loginBody = z.object({
  email,
  password,
});

export const authResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
  }),
  accessToken: z.string(),
  expiresIn: z.number().optional(),
  /** Sent in login/signup/refresh so the web app can set a same-origin cookie for server-side auth */
  refreshToken: z.string().optional(),
});

export type SignupBody = z.infer<typeof signupBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type AuthResponse = z.infer<typeof authResponse>;
