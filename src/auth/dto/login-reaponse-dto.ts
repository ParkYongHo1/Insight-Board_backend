import { ApiProperty } from '@nestjs/swagger';

class LoginData {
  @ApiProperty({ example: 'eyJhbG...' })
  accessToken: string;

  @ApiProperty({ example: '1714000000' })
  accessTokenExpiresAt: string;

  @ApiProperty({ example: 'yongho@example.com' })
  email: string;

  @ApiProperty({ example: '박용호' })
  name: string;

  @ApiProperty({
    example: 'SPACE_AEROSPACE',
    description: '사용자 관심 투자 테마',
  })
  interestTheme: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginData })
  loginData: LoginData;

  @ApiProperty({ example: 'eyJhbG_refresh...' })
  refreshToken: string;
}
