import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import type { AppConfig } from '../../config/app.config.js';
import type { AuthConfig } from '../../config/auth.config.js';
import { Invite } from '../../users/entities/invite.entity.js';
import { hashPassword, normalizeEmail } from '../auth.crypto.js';
import { AuthService } from '../auth.service.js';
import { User } from '../entities/user.entity.js';
import {
  createPkce,
  createState,
  OidcClient,
  readOidcSettings,
  type FetchFn,
  type OidcSettings,
} from './oidc.client.js';

export const OIDC_FETCH = Symbol('OIDC_FETCH');
export const OIDC_STATE_COOKIE = 'oidc_state';
export const OIDC_STATE_TTL_MS = 10 * 60 * 1000;

/** Short codes the sign-in screen turns into a sentence. */
export type OidcFailureCode =
  | 'oidc_failed'
  | 'oidc_not_invited'
  | 'oidc_disabled'
  | 'oidc_unverified';

export class OidcFailure extends Error {
  constructor(
    readonly code: OidcFailureCode,
    message: string = code,
  ) {
    super(message);
  }
}

type StatePayload = { state: string; verifier: string; exp: number };

export function signStateCookie(payload: StatePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function readStateCookie(
  value: string | undefined,
  secret: string,
  now: number = Date.now(),
): StatePayload | null {
  if (!value) return null;
  const [body, mac] = value.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<StatePayload>;
    if (
      typeof payload.state !== 'string' ||
      typeof payload.verifier !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now
    ) {
      return null;
    }
    return payload as StatePayload;
  } catch {
    return null;
  }
}

export type OidcCallbackParams = {
  code?: string;
  state?: string;
  error?: string;
};

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private client: { key: string; value: OidcClient } | null = null;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Invite)
    private readonly invites: Repository<Invite>,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Optional()
    @Inject(OIDC_FETCH)
    private readonly fetchFn?: FetchFn,
  ) {}

  isConfigured(): boolean {
    return this.settings() !== null;
  }

  /** Builds the provider redirect and the signed state cookie value. */
  async begin(): Promise<{ url: string; stateCookie: string }> {
    const client = this.requireClient();
    const state = createState();
    const { verifier, challenge } = createPkce();
    const url = await client.authorizationUrl(state, challenge);
    const stateCookie = signStateCookie(
      { state, verifier, exp: Date.now() + OIDC_STATE_TTL_MS },
      this.secret(),
    );
    return { url, stateCookie };
  }

  /** Finishes the flow and returns a session token for the app. */
  async complete(
    params: OidcCallbackParams,
    stateCookie: string | undefined,
  ): Promise<{ accessToken: string }> {
    if (params.error) {
      throw new OidcFailure('oidc_failed', `Provider returned ${params.error}`);
    }
    const saved = readStateCookie(stateCookie, this.secret());
    if (!saved || !params.state || params.state !== saved.state || !params.code) {
      throw new OidcFailure('oidc_failed', 'State did not match');
    }

    const client = this.requireClient();
    let info: Awaited<ReturnType<OidcClient['userInfo']>>;
    try {
      const accessToken = await client.exchangeCode(params.code, saved.verifier);
      info = await client.userInfo(accessToken);
    } catch (error) {
      this.logger.warn(
        `Company login failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new OidcFailure('oidc_failed');
    }

    if (!info.email) {
      throw new OidcFailure('oidc_failed', 'Provider returned no email');
    }
    if (!info.emailVerified) {
      await this.refuse(info.email, 'unverified_email');
      throw new OidcFailure('oidc_unverified');
    }

    const { user, created } = await this.signInByEmail(info.email);
    await this.audit.record({
      actor: { id: user.id, email: user.email },
      action: 'auth.oidc_login',
      targetType: 'user',
      targetId: user.id,
      metadata: { created },
    });
    return { accessToken: await this.auth.issueToken(user) };
  }

  /**
   * Existing active user: sign in. Pending invite: claim it, creating the user
   * or re-enabling a disabled one. Anything else is refused, so an account at
   * the identity provider is not enough to join.
   */
  private async signInByEmail(
    rawEmail: string,
  ): Promise<{ user: User; created: boolean }> {
    const email = normalizeEmail(rawEmail);
    const existing = await this.users.findOne({ where: { email } });

    if (existing && !existing.disabledAt) {
      if (!existing.emailVerifiedAt) {
        existing.emailVerifiedAt = new Date();
        await this.users.save(existing);
      }
      return { user: existing, created: false };
    }

    const invite = await this.invites.findOne({
      where: {
        email,
        acceptedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    if (!invite) {
      await this.refuse(email, existing ? 'disabled' : 'not_invited');
      throw new OidcFailure(existing ? 'oidc_disabled' : 'oidc_not_invited');
    }

    const claimed = await this.invites.update(
      { id: invite.id, acceptedAt: IsNull() },
      { acceptedAt: new Date() },
    );
    if (!claimed.affected) {
      await this.refuse(email, 'not_invited');
      throw new OidcFailure('oidc_not_invited');
    }

    if (existing) {
      existing.role = invite.role;
      existing.disabledAt = null;
      existing.emailVerifiedAt ??= new Date();
      existing.sessionVersion += 1;
      return { user: await this.users.save(existing), created: false };
    }

    // The row needs a password hash. Nobody knows this one, so only company
    // login (or an admin invite) can open the account.
    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
    const user = await this.users.save(
      this.users.create({
        email,
        passwordHash,
        role: invite.role,
        emailVerifiedAt: new Date(),
      }),
    );
    return { user, created: true };
  }

  private refuse(email: string, reason: string): Promise<void> {
    return this.audit.record({
      actor: null,
      action: 'auth.oidc_refused',
      targetType: 'user',
      targetId: null,
      metadata: { email, reason },
    });
  }

  private settings(): OidcSettings | null {
    const { webOrigin } = this.config.getOrThrow<AppConfig>('app');
    return readOidcSettings(
      (key) => this.config.get<string>(key),
      webOrigin,
    );
  }

  private requireClient(): OidcClient {
    const settings = this.settings();
    if (!settings) {
      throw new OidcFailure('oidc_failed', 'Company login is not configured');
    }
    const key = JSON.stringify(settings);
    if (this.client?.key !== key) {
      this.client = {
        key,
        value: new OidcClient(settings, this.fetchFn ?? fetch),
      };
    }
    return this.client.value;
  }

  private secret(): string {
    return this.config.getOrThrow<AuthConfig>('auth').jwtSecret;
  }
}
