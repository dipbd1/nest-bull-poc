import { IsString, IsNotEmpty } from 'class-validator';

export class CreateProducerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  model: string;
}
