import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { type Response, type Request } from 'express';
import { AuthService } from './auth.service';
import {
  FinalizeRegistrationDto,
  InviteUserDto,
  LoginDto,
} from 'src/user/dto/user.dto';
import { AccessTokenGuard, JwtPayload } from './guard/access-token.guard';
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
  async register(
    @Body() finalizeDto: FinalizeRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { loginData, refreshToken } = await this.authService.register(
      finalizeDto.token,
      finalizeDto,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return loginData;
  }

  @UseGuards(AccessTokenGuard)
  @Post('invite')
  async invite(@Body() inviteList: InviteUserDto[], @Req() req: Request) {
    const { email } = req.user as JwtPayload;
    return await this.authService.invite(inviteList, email);
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
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    await this.authService.logout((req.user as { sub: number }).sub);
  }
}
