import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from './auth.types.js';

/** Runs after AuthGuard, which loads the role from the user row. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
