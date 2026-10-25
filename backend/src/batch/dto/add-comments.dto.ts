import { IsString, MaxLength } from 'class-validator';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS } from '../batch.limits.js';

export class AddCommentsDto {
  /** Pasted text, one comment per line. */
  @IsString()
  @MaxLength(MAX_COMMENTS * (MAX_COMMENT_LENGTH + 2))
  comments: string;
}
