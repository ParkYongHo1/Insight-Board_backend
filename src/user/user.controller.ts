import {
  Controller,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { type Request } from 'express';
import { UserService } from './user.service';
import {
  AccessTokenGuard,
  JwtPayload,
} from 'src/auth/guard/access-token.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { UpdateNameDto, UpdatePasswordDto } from './dto/user.dto';

export class UpdateRoleDto {
  @IsString()
  role: string;
}

@ApiTags('03. 유저 (User)')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AccessTokenGuard)
  @Patch(':userId/role')
  @ApiOperation({ summary: '팀원 역할 변경' })
  async updateMemberRole(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Body() dto: UpdateRoleDto,
    @Req() req: Request,
  ) {
    const { sub: requesterId } = req.user as JwtPayload;
    return await this.userService.updateMemberRole(
      requesterId,
      targetUserId,
      dto.role,
    );
  }

  @UseGuards(AccessTokenGuard)
  @Delete(':userId')
  @ApiOperation({ summary: '팀원 삭제' })
  async removeMember(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Req() req: Request,
  ) {
    const { sub: requesterId } = req.user as JwtPayload;
    return await this.userService.removeMember(requesterId, targetUserId);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('name')
  @ApiOperation({ summary: '이름 변경' })
  async updateName(@Body() dto: UpdateNameDto, @Req() req: Request) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.userService.updateName(userId, dto.name);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('password')
  @ApiOperation({ summary: '비밀번호 변경' })
  async updatePassword(@Body() dto: UpdatePasswordDto, @Req() req: Request) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.userService.updatePassword(
      userId,
      dto.newPassword,
      dto.confirmPassword,
    );
  }
}
