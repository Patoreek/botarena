import { z } from "zod";

export const apiProvider = z.enum(["BINANCE", "OPENAI"]);
export type ApiProvider = z.infer<typeof apiProvider>;

export const createApiKeyBody = z
  .object({
    provider: apiProvider,
    label: z.string().min(1).max(100),
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1).optional(),
  })
  .refine(
    (d) => {
      if (d.provider === "BINANCE" && !d.apiSecret) {
        return false;
      }
      return true;
    },
    { message: "API secret is required for Binance", path: ["apiSecret"] }
  );
export type CreateApiKeyBody = z.infer<typeof createApiKeyBody>;

export const updateApiKeyBody = z.object({
  label: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1).optional(),
  apiSecret: z.string().min(1).optional(),
});
export type UpdateApiKeyBody = z.infer<typeof updateApiKeyBody>;

export const apiKeyResponseSchema = z.object({
  id: z.string(),
  provider: apiProvider,
  label: z.string(),
  keyHint: z.string(),
  hasSecret: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

export const apiKeyListResponse = z.array(apiKeyResponseSchema);
export type ApiKeyListResponse = z.infer<typeof apiKeyListResponse>;
