import { IsBoolean } from 'class-validator';

export class UpdateConsumerDto {
  @IsBoolean()
  running: boolean;
}
