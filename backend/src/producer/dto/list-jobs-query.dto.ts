import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const JOB_STATES = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const;

export type JobState = (typeof JOB_STATES)[number];

export type ListJobsQuery = {
  state: JobState;
  offset?: number;
  limit?: number;
};

export class ListJobsQueryDto {
  @IsIn(JOB_STATES)
  state: JobState;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
