import { IsString } from 'class-validator';

export class SlackConnectDto {
  @IsString()
  code: string;
}
