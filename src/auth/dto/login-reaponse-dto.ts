import { ApiProperty } from '@nestjs/swagger';

class ProjectListItem {
  @ApiProperty({ example: '1' })
  id: string;
  @ApiProperty({ example: '인사이트 보드' })
  name: string;
  @ApiProperty({ example: 'Role-based dashboard' })
  description: string;
  @ApiProperty({ example: 'ADMIN', enum: ['ADMIN', 'VIEWER'] })
  role: string;
}

class LoginData {
  @ApiProperty({ example: 'eyJhbG...' })
  accessToken: string;
  @ApiProperty({ example: '1714000000' })
  accessTokenExpiresAt: string;
  @ApiProperty({ example: 'yongho@example.com' })
  email: string;
  @ApiProperty({ example: '박용호' })
  name: string;
  @ApiProperty({ example: '소속 없음' })
  companyName: string;
  @ApiProperty({ type: [ProjectListItem] })
  projectList: ProjectListItem[];
}

export class LoginResponseDto {
  @ApiProperty()
  loginData: LoginData;
  @ApiProperty({ example: 'eyJhbG_refresh...' })
  refreshToken: string;
}
