import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  modelAllowlist?: string[];

  /** `null` keeps batches until someone deletes them. */
  @ValidateIf((_dto, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number | null;
}
