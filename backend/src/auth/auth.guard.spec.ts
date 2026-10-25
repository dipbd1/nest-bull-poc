import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import { AdminGuard } from './admin.guard.js';
import { AuthGuard } from './auth.guard.js';
import type { User } from './entities/user.entity.js';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    role: 'reviewer',
    disabledAt: null,
    sessionVersion: 2,
    ...overrides,
  } as User;
}

describe('AuthGuard', () => {
  const jwt = { verifyAsync: vi.fn() };
  const users = { findOne: vi.fn() };
  const guard = new AuthGuard(
    jwt as unknown as JwtService,
    users as unknown as Repository<User>,
  );

  beforeEach(() => {
    jwt.verifyAsync
      .mockReset()
      .mockResolvedValue({ sub: 'user-1', email: 'ada@example.com', sv: 2 });
    users.findOne.mockReset().mockResolvedValue(makeUser());
  });

  it('accepts the session cookie and loads the role from the user row', async () => {
    const request: Record<string, unknown> = {
      headers: { cookie: 'theme=dark; session=cookie-token' },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie-token');
    expect(request.user).toEqual({
      sub: 'user-1',
      email: 'ada@example.com',
      sv: 2,
      role: 'reviewer',
    });
  });

  it('accepts a bearer token', async () => {
    const request = { headers: { authorization: 'Bearer bearer-token' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('bearer-token');
  });

  it('rejects a request without a token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a disabled user even with a valid token', async () => {
    users.findOne.mockResolvedValue(makeUser({ disabledAt: new Date() }));
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token from an older session version', async () => {
    users.findOne.mockResolvedValue(makeUser({ sessionVersion: 3 }));
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token for a missing user', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('forbids a reviewer', () => {
    expect(() =>
      guard.canActivate(contextFor({ user: { role: 'reviewer' } })),
    ).toThrow(ForbiddenException);
  });

  it('allows an admin', () => {
    expect(guard.canActivate(contextFor({ user: { role: 'admin' } }))).toBe(
      true,
    );
  });
});
