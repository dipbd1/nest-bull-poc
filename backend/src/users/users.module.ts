import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Invite } from './entities/invite.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Invite]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
