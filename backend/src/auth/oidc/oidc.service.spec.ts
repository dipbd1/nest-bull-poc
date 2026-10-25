import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { AuditService } from '../../audit/audit.service.js';
import type { Invite } from '../../users/entities/invite.entity.js';
import type { AuthService } from '../auth.service.js';
import type { User } from '../entities/user.entity.js';
import { readOidcSettings } from './oidc.client.js';
import {
  OidcFailure,
  OidcService,
  readStateCookie,
  signStateCookie,
} from './oidc.service.js';

const ISSUER = 'https://idp.example.com';
const SECRET = 'jwt-secret-for-tests';
const WEB_ORIGIN = 'https://feedback.example.com';
const REDIRECT_URI = `${WEB_ORIGIN}/api/auth/oidc/callback`;

type Env = Record<string, string | undefined>;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    passwordHash: 'x:y',
    emailVerifiedAt: new Date('2026-01-01'),
    role: 'reviewer',
    disabledAt: null,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    registrationCodes: [],
    ...overrides,
  };
}

function makeInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'invite-1',
    email: 'ada@example.com',
    role: 'reviewer',
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 60_000),
    invitedById: 'admin-1',
    acceptedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readOidcSettings', () => {
  const lookup = (env: Env) => (key: string) => env[key];

  it('is null until issuer, client id, and client secret are all set', () => {
    expect(readOidcSettings(lookup({}), WEB_ORIGIN)).toBeNull();
    expect(
      readOidcSettings(
        lookup({ OIDC_ISSUER: ISSUER, OIDC_CLIENT_ID: 'id' }),
        WEB_ORIGIN,
      ),
    ).toBeNull();
  });

  it('derives the callback from WEB_ORIGIN and trims the issuer slash', () => {
    expect(
      readOidcSettings(
        lookup({
          OIDC_ISSUER: `${ISSUER}/`,
          OIDC_CLIENT_ID: 'id',
          OIDC_CLIENT_SECRET: 'secret',
        }),
        WEB_ORIGIN,
      ),
    ).toEqual({
      issuer: ISSUER,
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: REDIRECT_URI,
    });
  });
});

describe('state cookie', () => {
  it('round-trips, and rejects tampering and expiry', () => {
    const cookie = signStateCookie(
      { state: 's', verifier: 'v', exp: Date.now() + 1000 },
      SECRET,
    );
    expect(readStateCookie(cookie, SECRET)).toMatchObject({ state: 's' });
    expect(readStateCookie(`${cookie}x`, SECRET)).toBeNull();
    expect(readStateCookie(cookie, 'other-secret')).toBeNull();
    expect(readStateCookie(cookie, SECRET, Date.now() + 5000)).toBeNull();
    expect(readStateCookie(undefined, SECRET)).toBeNull();
  });
});

describe('OidcService', () => {
  let env: Env;
  let userInfo: Record<string, unknown>;
  let tokenStatus: number;
  let fetchFn: ReturnType<typeof vi.fn>;
  let users: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let invites: {
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let auth: { issueToken: ReturnType<typeof vi.fn> };
  let service: OidcService;

  beforeEach(() => {
    env = {
      OIDC_ISSUER: ISSUER,
      OIDC_CLIENT_ID: 'client-1',
      OIDC_CLIENT_SECRET: 'client-secret',
    };
    userInfo = { sub: 'sub-1', email: 'Ada@Example.com', email_verified: true };
    tokenStatus = 200;
    fetchFn = vi.fn(async (input: string) => {
      const url = input;
      if (url.endsWith('/.well-known/openid-configuration')) {
        return json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/authorize`,
          token_endpoint: `${ISSUER}/token`,
          userinfo_endpoint: `${ISSUER}/userinfo`,
        });
      }
      if (url === `${ISSUER}/token`) {
        return tokenStatus === 200
          ? json({ access_token: 'provider-access-token' })
          : json({ error: 'invalid_grant' }, tokenStatus);
      }
      if (url === `${ISSUER}/userinfo`) return json(userInfo);
      return json({}, 404);
    });
    users = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn(async (user: User) => {
        user.id ??= 'user-new';
        user.sessionVersion ??= 1;
        return user;
      }),
      create: vi.fn((user: Partial<User>) => user),
    };
    invites = {
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    audit = { record: vi.fn() };
    auth = { issueToken: vi.fn().mockResolvedValue('session-token') };

    const config = {
      get: vi.fn((key: string) => env[key]),
      getOrThrow: vi.fn((key: string) => {
        if (key === 'app') return { webOrigin: WEB_ORIGIN, isProduction: true };
        if (key === 'auth') return { jwtSecret: SECRET };
        throw new Error(`unexpected config key ${key}`);
      }),
    };
    service = new OidcService(
      users as unknown as Repository<User>,
      invites as unknown as Repository<Invite>,
      auth as unknown as AuthService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
      fetchFn as unknown as typeof fetch,
    );
  });

  async function callback(): Promise<{ accessToken: string }> {
    const { url, stateCookie } = await service.begin();
    const state = new URL(url).searchParams.get('state') as string;
    return service.complete({ code: 'auth-code', state }, stateCookie);
  }

  it('reports whether company login is configured', () => {
    expect(service.isConfigured()).toBe(true);
    env.OIDC_CLIENT_SECRET = '';
    expect(service.isConfigured()).toBe(false);
  });

  it('builds a PKCE authorization URL and a signed state cookie', async () => {
    const { url, stateCookie } = await service.begin();

    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${ISSUER}/authorize`);
    expect(parsed.searchParams.get('client_id')).toBe('client-1');
    expect(parsed.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(readStateCookie(stateCookie, SECRET)?.state).toBe(
      parsed.searchParams.get('state'),
    );
    expect(url).not.toContain('client-secret');
  });

  it('signs in an existing active user without an invite', async () => {
    users.findOne.mockResolvedValue(makeUser());

    await expect(callback()).resolves.toEqual({ accessToken: 'session-token' });

    expect(users.findOne).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
    });
    expect(users.save).not.toHaveBeenCalled();
    expect(invites.update).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.oidc_login',
        metadata: { created: false },
      }),
    );
  });

  it('marks an unverified existing user as verified on sign-in', async () => {
    const user = makeUser({ emailVerifiedAt: null });
    users.findOne.mockResolvedValue(user);

    await callback();

    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
    );
  });

  it('creates the user from a pending invite and consumes it', async () => {
    invites.findOne.mockResolvedValue(makeInvite({ role: 'admin' }));

    await expect(callback()).resolves.toEqual({ accessToken: 'session-token' });

    expect(invites.update).toHaveBeenCalledWith(
      { id: 'invite-1', acceptedAt: expect.anything() as unknown },
      { acceptedAt: expect.any(Date) as unknown },
    );
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        role: 'admin',
        emailVerifiedAt: expect.any(Date),
      }),
    );
    const created = users.create.mock.calls[0][0] as { passwordHash: string };
    expect(created.passwordHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.oidc_login',
        metadata: { created: true },
      }),
    );
  });

  it('refuses an unknown email with no pending invite', async () => {
    const error = await callback().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(OidcFailure);
    expect((error as OidcFailure).code).toBe('oidc_not_invited');
    expect(users.save).not.toHaveBeenCalled();
    expect(auth.issueToken).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.oidc_refused',
        metadata: { email: 'ada@example.com', reason: 'not_invited' },
      }),
    );
  });

  it('refuses when the invite was claimed by someone else first', async () => {
    invites.findOne.mockResolvedValue(makeInvite());
    invites.update.mockResolvedValue({ affected: 0 });

    const error = await callback().catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_not_invited');
    expect(users.save).not.toHaveBeenCalled();
  });

  it('refuses a disabled user who has no pending invite', async () => {
    users.findOne.mockResolvedValue(makeUser({ disabledAt: new Date() }));

    const error = await callback().catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_disabled');
    expect(auth.issueToken).not.toHaveBeenCalled();
  });

  it('re-enables a disabled user who has a pending invite and bumps the session', async () => {
    const user = makeUser({ disabledAt: new Date(), sessionVersion: 3 });
    users.findOne.mockResolvedValue(user);
    invites.findOne.mockResolvedValue(makeInvite({ role: 'reviewer' }));

    await callback();

    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ disabledAt: null, sessionVersion: 4 }),
    );
  });

  it('refuses an email the provider has not verified', async () => {
    userInfo.email_verified = false;
    invites.findOne.mockResolvedValue(makeInvite());

    const error = await callback().catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_unverified');
    expect(users.save).not.toHaveBeenCalled();
    expect(invites.update).not.toHaveBeenCalled();
  });

  it('refuses a callback whose state does not match the cookie', async () => {
    const { stateCookie } = await service.begin();
    fetchFn.mockClear();

    const error = await service
      .complete({ code: 'auth-code', state: 'forged' }, stateCookie)
      .catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_failed');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a callback with no state cookie', async () => {
    const error = await service
      .complete({ code: 'auth-code', state: 'anything' }, undefined)
      .catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_failed');
  });

  it('refuses when the provider returns an error', async () => {
    const { stateCookie } = await service.begin();

    const error = await service
      .complete({ error: 'access_denied' }, stateCookie)
      .catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_failed');
  });

  it('fails closed when the token exchange is rejected', async () => {
    tokenStatus = 400;
    users.findOne.mockResolvedValue(makeUser());

    const error = await callback().catch((err: unknown) => err);

    expect((error as OidcFailure).code).toBe('oidc_failed');
    expect(auth.issueToken).not.toHaveBeenCalled();
  });

  it('sends the PKCE verifier and client credentials to the token endpoint', async () => {
    users.findOne.mockResolvedValue(makeUser());
    const { url, stateCookie } = await service.begin();
    const state = new URL(url).searchParams.get('state') as string;

    await service.complete({ code: 'auth-code', state }, stateCookie);

    const tokenCall = fetchFn.mock.calls.find(
      ([target]) => String(target) === `${ISSUER}/token`,
    ) as [string, RequestInit];
    const body = tokenCall[1].body as URLSearchParams;
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(body.get('code_verifier')).toBe(
      readStateCookie(stateCookie, SECRET)?.verifier,
    );
    const headers = tokenCall[1].headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
  });
});
