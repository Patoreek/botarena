import * as jose from "jose";

/** User-like payload from API (dates may be serialized as strings). */
type UserLike = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");
const EXPIRY = "60s";

export async function signOneTimeToken(user: UserLike): Promise<string> {
  const createdAt =
    user.createdAt instanceof Date
      ? user.createdAt.toISOString()
      : typeof user.createdAt === "string"
        ? user.createdAt
        : new Date().toISOString();
  const updatedAt =
    user.updatedAt instanceof Date
      ? user.updatedAt.toISOString()
      : typeof user.updatedAt === "string"
        ? user.updatedAt
        : new Date().toISOString();
  return await new jose.SignJWT({
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    createdAt,
    updatedAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret());
}

export async function verifyOneTimeToken(
  token: string
): Promise<{
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret());
    if (
      typeof payload.id === "string" &&
      typeof payload.email === "string" &&
      (payload.name === null || typeof payload.name === "string")
    ) {
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name ?? null,
        createdAt:
          typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString(),
        updatedAt:
          typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
