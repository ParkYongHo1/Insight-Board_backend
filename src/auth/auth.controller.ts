import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { type Response, type Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SignUpDto } from 'src/user/dto/user.dto';
import { AccessTokenGuard } from './guard/access-token.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginResponseDto } from './dto/login-reaponse-dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
} as const;

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

    // 보안인증용 쿠키 설정 적용
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return loginData;
  }
  @Post('register')
  async register(
    @Body() signUpDto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { loginData, refreshToken } =
      await this.authService.register(signUpDto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return loginData;
  }
  @Post('refresh')
  @ApiOperation({ summary: '토큰 만료시 리프레시 갱신 (RTR)' })
  async rotateToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refreshToken'] as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('refreshToken이 없습니다.');
    }

    try {
      const {
        accessToken,
        accessTokenExpiresAt,
        refreshToken: newRefreshToken,
      } = await this.authService.rotateToken(refreshToken);

      res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
      return { accessToken, accessTokenExpiresAt };
    } catch (err) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });
      throw err;
    }
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  @ApiOperation({ summary: '로그아웃 및 쿠키 제거' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // 발급할 때와 동일한 도메인 보안 정책으로 브라우저 쿠키 삭제 처리
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    await this.authService.logout((req.user as { sub: number }).sub);
  }
}
