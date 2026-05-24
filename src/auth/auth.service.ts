import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserModel } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { RedisService } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';
import { SignUpDto } from 'src/user/dto/user.dto';

interface TokenPayload {
  sub: number;
  email: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly redis: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient();
  }

  async signToken(
    user: Pick<UserModel, 'id' | 'email'>,
    isRefreshToken: boolean,
  ): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      type: isRefreshToken ? 'refresh' : 'access',
    };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: isRefreshToken
        ? '7d'
        : process.env.NODE_ENV === 'production'
          ? '1h'
          : '70s',
    });

    if (isRefreshToken) {
      await this.redis.set(
        `refresh_token:${user.id}`,
        token,
        'EX',
        7 * 24 * 60 * 60,
      );
    }

    return token;
  }

  async loginUser(user: UserModel) {
    const accessToken = await this.signToken(user, false);
    const refreshToken = await this.signToken(user, true);

    const loginData = {
      accessToken,
      accessTokenExpiresAt: (
        Math.floor(Date.now() / 1000) +
        (process.env.NODE_ENV === 'production' ? 3600 : 70)
      ).toString(),
      email: user.email,
      name: user.name || '박용호',
    };

    return {
      loginData,
      refreshToken,
    };
  }

  /**
   * 🛠️ [수정] 일반 일반 회원가입 엔트리 비즈니스 로직
   * 초대 토큰(token) 검증 방식을 걷어내고 SignUpDto 기반으로 다이렉트 가입 처리합니다.
   */
  async register(dto: SignUpDto) {
    const isExist = await this.userService.getUserByEmail(dto.email);
    if (isExist) {
      throw new BadRequestException('이미 가입된 이메일입니다.');
    }
    const isNameExist = await this.userService.getUserByName(dto.name);
    if (isNameExist) {
      throw new BadRequestException(
        '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.',
      );
    }

    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      dto.password = await bcrypt.hash(dto.password, salt);
    }

    await this.userService.finalizeRegistration(dto);

    const user = await this.userService.getUserByEmail(dto.email);
    if (!user) throw new BadRequestException('유저 정보 생성 및 조회 실패');

    return this.loginUser(user);
  }

  /**
   * 이메일 로그인 비밀번호 검증
   */
  async authenticateWithEmailAndPassword(
    user: Pick<UserModel, 'email' | 'password'>,
  ): Promise<UserModel> {
    const existingUser = await this.userService.getUserByEmail(user.email);

    if (!existingUser || !existingUser.password || !user.password) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 일치하지 않습니다.',
      );
    }

    const isMatch = await bcrypt.compare(user.password, existingUser.password);
    if (!isMatch) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 일치하지 않습니다.',
      );
    }

    return existingUser;
  }

  async loginWithEmail(user: Pick<UserModel, 'email' | 'password'>) {
    const existingUser = await this.authenticateWithEmailAndPassword(user);
    return this.loginUser(existingUser);
  }

  async logout(userId: number) {
    await this.redis.del(`refresh_token:${userId}`);
  }

  async rotateToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('유효하지 않은 토큰 타입입니다.');
      }

      const savedToken = await this.redis.get(`refresh_token:${payload.sub}`);
      if (savedToken !== refreshToken) {
        throw new UnauthorizedException(
          '이미 사용 되었거나 만료된 토큰입니다.',
        );
      }

      const user = await this.userService.getUserByEmail(payload.email);
      if (!user) throw new UnauthorizedException('유저를 찾을 수 없습니다.');

      const accessToken = await this.signToken(user, false);
      const newRefreshToken = await this.signToken(user, true);

      return {
        accessToken,
        accessTokenExpiresAt: (
          Math.floor(Date.now() / 1000) +
          (process.env.NODE_ENV === 'production' ? 3600 : 70)
        ).toString(),
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException(
        '토큰이 만료되었거나 갱신에 실패했습니다.',
      );
    }
  }
}
