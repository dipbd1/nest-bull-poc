import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/app.config.js';
import { AuthService } from '../auth.service.js';
import {
  readCookie,
  sessionCookieOptions,
  setSessionCookie,
} from '../session-cookie.js';
import {
  OIDC_STATE_COOKIE,
  OIDC_STATE_TTL_MS,
  OidcFailure,
  OidcService,
  type OidcFailureCode,
} from './oidc.service.js';

/**
 * Browser-facing company login. These are full-page navigations, not fetch
 * calls: the SPA links to `/api/auth/oidc/start`, and the provider sends the
 * browser back to `/api/auth/oidc/callback`. Both end in a redirect to the SPA.
 */
@Controller('auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);

  constructor(
    private readonly oidc: OidcService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('start')
  async start(@Res() res: Response): Promise<void> {
    if (!this.oidc.isConfigured()) {
      this.redirectToSignIn(res, 'oidc_failed');
      return;
    }
    try {
      const { url, stateCookie } = await this.oidc.begin();
      res.cookie(OIDC_STATE_COOKIE, stateCookie, {
        ...sessionCookieOptions(this.isProduction()),
        maxAge: OIDC_STATE_TTL_MS,
      });
      res.redirect(302, url);
    } catch (error) {
      this.logger.warn(
        `Could not start company login: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.redirectToSignIn(res, 'oidc_failed');
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const stateCookie = readCookie(req.headers.cookie, OIDC_STATE_COOKIE);
    res.clearCookie(OIDC_STATE_COOKIE, sessionCookieOptions(this.isProduction()));
    try {
      const { accessToken } = await this.oidc.complete(
        { code, state, error },
        stateCookie,
      );
      setSessionCookie(
        res,
        accessToken,
        this.isProduction(),
        this.auth.tokenExpiry(accessToken),
      );
      res.redirect(302, `${this.webOrigin()}/`);
    } catch (failure) {
      if (!(failure instanceof OidcFailure)) {
        this.logger.error('Company login crashed', failure as Error);
      }
      this.redirectToSignIn(
        res,
        failure instanceof OidcFailure ? failure.code : 'oidc_failed',
      );
    }
  }

  private redirectToSignIn(res: Response, code: OidcFailureCode): void {
    res.redirect(302, `${this.webOrigin()}/login?error=${code}`);
  }

  private webOrigin(): string {
    return this.config.getOrThrow<AppConfig>('app').webOrigin;
  }

  private isProduction(): boolean {
    return this.config.getOrThrow<AppConfig>('app').isProduction;
  }
}
