export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthUser = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
};

export type AuthPublicConfig = {
  emailVerificationRequired: boolean;
};

export type RegisterResult =
  | { email: string; verificationRequired: true }
  | { email: string; verificationRequired: false; accessToken: string };
