import {
  Controller,
  Patch,
  Body,
  UseGuards,
  Req,
  Post,
  Delete,
  Get,
} from '@nestjs/common';
import { type Request } from 'express';
import { UserService } from './user.service';
import { SlackConnectDto } from './dto/slack-connect.dto';
import {
  AccessTokenGuard,
  JwtPayload,
} from 'src/auth/guard/access-token.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateNameDto, UpdatePasswordDto } from './dto/user.dto';

@ApiTags('03. 유저 (User)')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
  @UseGuards(AccessTokenGuard)
  @Post('slack/connect')
  @ApiOperation({ summary: 'Slack 계정 연동' })
  async connectSlack(@Body() dto: SlackConnectDto, @Req() req: Request) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.userService.connectSlack(userId, dto.code);
  }

  @UseGuards(AccessTokenGuard)
  @Delete('slack/disconnect')
  @ApiOperation({ summary: 'Slack 연동 해제' })
  async disconnectSlack(@Req() req: Request) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.userService.disconnectSlack(userId);
  }

  @UseGuards(AccessTokenGuard)
  @Get('slack/status')
  @ApiOperation({ summary: 'Slack 연동 상태 확인' })
  async getSlackStatus(@Req() req: Request) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.userService.getSlackStatus(userId);
  }
}
