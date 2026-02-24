import type { User } from "@repo/shared";

export type Session = {
  user: User;
  accessToken: string;
};

export type AuthResult = {
  user: User;
  accessToken: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}
