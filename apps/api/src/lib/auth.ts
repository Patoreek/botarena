import * as argon2 from "argon2";
import * as jose from "jose";
import { randomBytes } from "node:crypto";
import type { User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

const secret = new TextEncoder().encode(JWT_SECRET);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function signAccessToken(payload: { sub: string; email: string }): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRES_IN)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    if (typeof payload.sub === "string" && typeof payload.email === "string") {
      return { sub: payload.sub, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export async function hashRefreshToken(token: string): Promise<string> {
  return argon2.hash(token, { type: argon2.argon2id });
}

export async function verifyRefreshTokenHash(hashed: string, plain: string): Promise<boolean> {
  return argon2.verify(hashed, plain);
}

export function getRefreshTokenExpiry(): Date {
  const match = JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  const value = match ? parseInt(match[1]!, 10) : 7;
  const unit = match?.[2] ?? "d";
  const now = Date.now();
  const ms =
    unit === "d"
      ? value * 24 * 60 * 60 * 1000
      : unit === "h"
        ? value * 60 * 60 * 1000
        : unit === "m"
          ? value * 60 * 1000
          : value * 1000;
  return new Date(now + ms);
}

export function userToJson(user: User): {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
