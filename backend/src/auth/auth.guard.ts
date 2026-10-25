import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import type { JwtPayload, RequestUser } from './auth.types.js';
import { User } from './entities/user.entity.js';
import { readCookie, SESSION_COOKIE } from './session-cookie.js';

export function tokenFromRequest(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return readCookie(request.headers.cookie, SESSION_COOKIE) || undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const token = tokenFromRequest(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.disabledAt || payload.sv !== user.sessionVersion) {
      throw new UnauthorizedException();
    }

    request.user = {
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
      role: user.role,
    };
    return true;
  }
}
