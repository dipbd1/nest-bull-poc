import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { USER_ROLES, type UserRole } from '../../auth/entities/user.entity.js';

export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
