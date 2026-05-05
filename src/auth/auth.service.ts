import { MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { FinalizeRegistrationDto, InviteUserDto } from 'src/user/dto/user.dto';
import { UserModel } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { RedisService } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';

interface InvitePayload {
  email: string;
  companyId: number;
  projectId?: number;
}
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
    private readonly mailerService: MailerService,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient();
  }

  /**
   * 토큰 생성 및 Redis 저장
   */
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
          : '70s', // 로컬 70초
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

  /**
   * 로그인 데이터 가공
   */
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
      companyName: user.company?.name || '소속 없음',
      projectList:
        user.projectMemberships?.map((membership) => ({
          id: membership.project.id.toString(),
          name: membership.project.name,
          description: membership.project.description,
          role: membership.role,
          createdAt: membership.project.createdAt,
        })) || [],
    };

    return {
      loginData,
      refreshToken,
    };
  }

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

  async register(token: string, dto: FinalizeRegistrationDto) {
    const payload = this.jwtService.verify<InvitePayload>(token, {
      secret: process.env.JWT_INVITE_SECRET,
    });

    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      dto.password = await bcrypt.hash(dto.password, salt);
    }

    await this.userService.finalizeRegistration(payload.email, dto);

    const user = await this.userService.getUserByEmail(payload.email);
    if (!user) throw new BadRequestException('유저 정보 조회 실패');

    return this.loginUser(user);
  }

  async invite(inviteList: InviteUserDto[], email: string) {
    const currentUser = await this.userService.getUserByEmail(email);
    if (!currentUser)
      throw new UnauthorizedException('유저를 찾을 수 없습니다.');

    const companyId = currentUser.companyId;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const invitedUsers = await this.userService.inviteUsers(
      inviteList,
      companyId,
    );

    // await 제거 - 이메일은 백그라운드로 처리
    Promise.all(
      invitedUsers.map(async (user) => {
        const targetDto = inviteList.find((dto) => dto.email === user.email);
        const inviteToken = this.jwtService.sign(
          {
            email: user.email,
            companyId,
            projectId: targetDto?.projectId,
          } as InvitePayload,
          { secret: process.env.JWT_INVITE_SECRET, expiresIn: '24h' },
        );

        await this.mailerService.sendMail({
          to: user.email,
          subject: `[Insight Board] 프로젝트 초대`,
          html: `<p>아래 링크를 클릭하여 가입을 완료하세요.</p><a href="${frontendUrl}/sign-up?token=${inviteToken}">가입하기</a>`,
        });

        console.log(`메일 발송 성공: ${user.email}`); // 추가
      }),
    ).catch((err) =>
      console.error('메일 발송 실패 상세:', JSON.stringify(err)),
    );

    return { message: '초대 메일이 발송되었습니다.' };
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
          '이미 사용되었거나 유효하지 않은 토큰입니다.',
        );
      }

      const user = await this.userService.getUserByEmail(payload.email);
      if (!user) throw new UnauthorizedException('유저를 찾을 수 없습니다.');

      const accessToken = await this.signToken(user, false);

      return {
        accessToken,
        accessTokenExpiresAt: (
          Math.floor(Date.now() / 1000) +
          (process.env.NODE_ENV === 'production' ? 3600 : 70)
        ).toString(),
      };
    } catch {
      throw new UnauthorizedException(
        '토큰이 만료되었거나 갱신에 실패했습니다.',
      );
    }
  }
}
