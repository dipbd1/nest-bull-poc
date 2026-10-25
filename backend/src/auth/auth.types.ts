import type { UserRole } from './entities/user.entity.js';

export type JwtPayload = {
  sub: string;
  email: string;
  sv: number;
};

/** Set on the request by AuthGuard after the user row is loaded. */
export type RequestUser = JwtPayload & { role: UserRole };

export type AuthUser = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  role: UserRole;
};

export type AuthPublicConfig = {
  emailVerificationRequired: boolean;
  publicRegistration: boolean;
  /** True when OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET are set. */
  companyLogin: boolean;
};

export type RegisterResult =
  | { email: string; verificationRequired: true }
  | { email: string; verificationRequired: false; accessToken: string };
