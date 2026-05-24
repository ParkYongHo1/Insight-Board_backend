import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: '우주항공 & AI 인프라 플랫폼' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: '로켓랩, 플래닛랩스 등 실시간 퀀트 모니터링 시스템',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
