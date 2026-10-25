import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RerunBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model: string;
}
