import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthBootstrap implements OnApplicationBootstrap {
  constructor(private readonly auth: AuthService) {}

  onApplicationBootstrap(): Promise<void> {
    return this.auth.bootstrapAdmin();
  }
}
