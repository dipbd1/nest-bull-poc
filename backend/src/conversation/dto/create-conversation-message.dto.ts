import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
