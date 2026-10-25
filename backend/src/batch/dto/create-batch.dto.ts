import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MAX_COMMENT_LENGTH,
  MAX_COMMENTS,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  MIN_COMMENTS,
  MIN_TAGS,
} from '../batch.limits.js';

export class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title: string;

  @IsArray()
  @ArrayMinSize(MIN_TAGS)
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  tags: string[];

  /** One string per comment. Line breaks stay inside that comment. */
  @IsArray()
  @ArrayMinSize(MIN_COMMENTS)
  @ArrayMaxSize(MAX_COMMENTS)
  @IsString({ each: true })
  @MaxLength(MAX_COMMENT_LENGTH, { each: true })
  comments: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model: string;
}
