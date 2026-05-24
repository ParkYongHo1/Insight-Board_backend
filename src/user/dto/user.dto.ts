import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'yongho@example.com', description: '사용자 이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ example: 'password1234', description: '비밀번호' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;
}
export class SignUpDto {
  @ApiProperty({ example: 'yongho@example.com', description: '사용자 이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ example: 'password1234', description: '비밀번호' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;

  @ApiProperty({ example: '박용호', description: '변경할 이름' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;
}

export class UpdateNameDto {
  @ApiProperty({ example: '박용호', description: '변경할 이름' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;
}

export class UpdatePasswordDto {
  @ApiProperty({ example: 'newpassword123', description: '새 비밀번호' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ example: 'newpassword123', description: '비밀번호 확인' })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}

export class UpdateThemeDto {
  @ApiProperty({
    example: 'SPACE_AEROSPACE',
    description: '변경할 관심 투자 테마',
  })
  @IsString()
  @IsNotEmpty()
  interestTheme: string;
}
