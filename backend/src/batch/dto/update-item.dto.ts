import { IsString, MaxLength } from 'class-validator';
import { MAX_TAG_LENGTH } from '../batch.limits.js';

export class UpdateItemDto {
  @IsString()
  @MaxLength(MAX_TAG_LENGTH)
  finalTag: string;
}
