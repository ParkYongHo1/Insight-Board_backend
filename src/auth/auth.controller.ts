import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { type Response, type Request } from 'express';
import { AuthService } from './auth.service';
import {
  FinalizeRegistrationDto,
  InviteUserDto,
  LoginDto,
} from 'src/user/dto/user.dto';
import { AccessTokenGuard } from './guard/access-token.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginResponseDto } from './dto/login-reaponse-dto';

@ApiTags('01. 인증 (Auth)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '로그인' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { loginData, refreshToken } =
      await this.authService.loginWithEmail(loginDto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return loginData;
  }

  @Post('register')
  async register(@Body() finalizeDto: FinalizeRegistrationDto) {
    return await this.authService.register(finalizeDto.token, finalizeDto);
  }

  @UseGuards(AccessTokenGuard)
  @Post('invite')
  async invite(@Body() inviteList: InviteUserDto[]) {
    return await this.authService.invite(inviteList);
  }
  @Post('refresh')
  async rotateToken(@Req() req: Request) {
    const refreshToken = req.cookies['refreshToken'] as string | undefined;

    if (!refreshToken) {
      return null;
    }
    return await this.authService.rotateToken(refreshToken);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  async logout(@Body('userId') userId: number) {
    return await this.authService.logout(userId);
  }
}
