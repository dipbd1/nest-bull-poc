import { IsEmail, IsIn } from 'class-validator';
import { USER_ROLES, type UserRole } from '../../auth/entities/user.entity.js';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsIn(USER_ROLES)
  role: UserRole;
}
