import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: RequestUser }>();
    return request.user;
  },
);
