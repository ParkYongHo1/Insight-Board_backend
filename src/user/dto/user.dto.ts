import { PickType } from '@nestjs/swagger';
import { UserModel } from '../entities/user.entity';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
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

export class InviteUserDto extends PickType(UserModel, ['email', 'role']) {
  @ApiProperty({
    example: 1,
    description: '초대할 프로젝트 ID',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  projectId?: number;
}

export class FinalizeRegistrationDto {
  @ApiProperty({ description: '초대 메일에 포함된 인증 토큰' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: '박용호', description: '사용자 이름' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'password1234', description: '설정할 비밀번호' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class UpdateNameDto {
  @ApiProperty({ example: '박용호' })
  @IsString()
  @MinLength(2)
  name: string;
}

export class UpdatePasswordDto {
  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}
