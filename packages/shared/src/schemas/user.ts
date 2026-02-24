import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export const updateProfileBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    { message: "Current password required to set new password", path: ["currentPassword"] }
  );

export const meResponse = userSchema;

export type User = z.infer<typeof userSchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBody>;
export type MeResponse = z.infer<typeof meResponse>;
