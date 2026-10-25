import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'session';

export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isProduction,
  };
}

export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export function setSessionCookie(
  res: Response,
  token: string,
  isProduction: boolean,
  expiresAt?: Date,
): void {
  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(isProduction),
    ...(expiresAt ? { expires: expiresAt } : {}),
  });
}

export function clearSessionCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(isProduction));
}
