import { createHash, randomBytes } from 'node:crypto';

export type OidcSettings = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** `${WEB_ORIGIN}/api/auth/oidc/callback`. Register this at the provider. */
  redirectUri: string;
};

export type OidcUserInfo = {
  sub: string;
  email: string;
  /** `false` only when the provider says so. Some providers omit the claim. */
  emailVerified: boolean;
};

type DiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  token_endpoint_auth_methods_supported?: string[];
};

export type FetchFn = typeof fetch;

export const OIDC_CALLBACK_PATH = '/api/auth/oidc/callback';
const REQUEST_TIMEOUT_MS = 10_000;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

type ConfigLookup = (key: string) => string | undefined;

/** Returns `null` unless issuer, client id, and client secret are all set. */
export function readOidcSettings(
  get: ConfigLookup,
  webOrigin: string,
): OidcSettings | null {
  const issuer = get('OIDC_ISSUER')?.trim();
  const clientId = get('OIDC_CLIENT_ID')?.trim();
  const clientSecret = get('OIDC_CLIENT_SECRET')?.trim();
  if (!issuer || !clientId || !clientSecret) return null;
  return {
    issuer: issuer.replace(/\/+$/, ''),
    clientId,
    clientSecret,
    redirectUri: `${webOrigin}${OIDC_CALLBACK_PATH}`,
  };
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function createState(): string {
  return randomBytes(24).toString('base64url');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Authorization-code flow with PKCE against one provider. The access token
 * comes straight from the token endpoint over TLS, and identity is read from
 * the userinfo endpoint with it. `fetch` is injectable so tests need no IdP.
 */
export class OidcClient {
  private discovered: { doc: DiscoveryDocument; at: number } | null = null;

  constructor(
    private readonly settings: OidcSettings,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async authorizationUrl(state: string, challenge: string): Promise<string> {
    const { authorization_endpoint } = await this.discovery();
    const url = new URL(authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.settings.clientId);
    url.searchParams.set('redirect_uri', this.settings.redirectUri);
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCode(code: string, verifier: string): Promise<string> {
    const doc = await this.discovery();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.settings.redirectUri,
      code_verifier: verifier,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };
    const methods = doc.token_endpoint_auth_methods_supported;
    if (!methods || methods.includes('client_secret_basic')) {
      const pair = `${encodeURIComponent(this.settings.clientId)}:${encodeURIComponent(this.settings.clientSecret)}`;
      headers.Authorization = `Basic ${Buffer.from(pair).toString('base64')}`;
    } else {
      body.set('client_id', this.settings.clientId);
      body.set('client_secret', this.settings.clientSecret);
    }

    const response = await this.fetchFn(doc.token_endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Token endpoint answered ${response.status}`);
    }
    const payload: unknown = await response.json();
    const token = isRecord(payload) ? str(payload.access_token) : '';
    if (!token) throw new Error('Token response had no access_token');
    return token;
  }

  async userInfo(accessToken: string): Promise<OidcUserInfo> {
    const doc = await this.discovery();
    const response = await this.fetchFn(doc.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Userinfo endpoint answered ${response.status}`);
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error('Userinfo was not an object');
    const sub = str(payload.sub);
    const email = str(payload.email).trim();
    if (!sub) throw new Error('Userinfo had no sub');
    return {
      sub,
      email,
      emailVerified: payload.email_verified !== false,
    };
  }

  private async discovery(): Promise<DiscoveryDocument> {
    if (this.discovered && Date.now() - this.discovered.at < DISCOVERY_TTL_MS) {
      return this.discovered.doc;
    }
    const response = await this.fetchFn(
      `${this.settings.issuer}/.well-known/openid-configuration`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Discovery answered ${response.status}`);
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error('Discovery was not an object');
    const doc: DiscoveryDocument = {
      issuer: str(payload.issuer),
      authorization_endpoint: str(payload.authorization_endpoint),
      token_endpoint: str(payload.token_endpoint),
      userinfo_endpoint: str(payload.userinfo_endpoint),
      token_endpoint_auth_methods_supported: Array.isArray(
        payload.token_endpoint_auth_methods_supported,
      )
        ? payload.token_endpoint_auth_methods_supported.filter(
            (method): method is string => typeof method === 'string',
          )
        : undefined,
    };
    if (doc.issuer.replace(/\/+$/, '') !== this.settings.issuer) {
      throw new Error('Discovery issuer does not match OIDC_ISSUER');
    }
    if (
      !doc.authorization_endpoint ||
      !doc.token_endpoint ||
      !doc.userinfo_endpoint
    ) {
      throw new Error('Discovery is missing an endpoint');
    }
    this.discovered = { doc, at: Date.now() };
    return doc;
  }
}
