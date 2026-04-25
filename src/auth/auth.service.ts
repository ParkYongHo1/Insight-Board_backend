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
      expiresIn: isRefreshToken ? '7d' : '1h',
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
      accessTokenExpiresAt: (Math.floor(Date.now() / 1000) + 3600).toString(),
      email: user.email,
      name: user.name || '박용호',
      companyName: user.company?.name || '소속 없음',
      projectList:
        user.projectMemberships?.map((membership) => ({
          id: membership.project.id.toString(),
          name: membership.project.name,
          description: membership.project.description,
          role: membership.role,
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

    // 1. 유저 정보 업데이트 (이름, 비번)
    await this.userService.finalizeRegistration(payload.email, dto);

    // 2. [핵심] 조인이 완벽하게 완료된 유저 데이터를 새로 가져옴
    const user = await this.userService.getUserByEmail(payload.email);
    if (!user) throw new BadRequestException('유저 정보 조회 실패');

    return this.loginUser(user);
  }

  async invite(inviteList: InviteUserDto[]) {
    const invitedUsers = await this.userService.inviteUsers(inviteList);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    await Promise.all(
      invitedUsers.map(async (user) => {
        const targetDto = inviteList.find((dto) => dto.email === user.email);

        const inviteToken = this.jwtService.sign(
          {
            email: user.email,
            companyId: user.companyId,
            projectId: targetDto?.projectId,
          } as InvitePayload, // 정의된 인터페이스 사용
          {
            secret: process.env.JWT_INVITE_SECRET,
            expiresIn: '24h',
          },
        );

        const invitationLink = `${frontendUrl}/sign-up?token=${inviteToken}`;

        await this.mailerService.sendMail({
          to: user.email,
          subject: `[Insight Board] 프로젝트 초대`,
          html: `<p>아래 링크를 클릭하여 가입을 완료하세요.</p><a href="${invitationLink}">가입하기</a>`,
        });
      }),
    );

    return { message: '초대 메일이 발송되었습니다.' };
  }

  async logout(userId: number) {
    await this.redis.del(`refresh_token:${userId}`);
    return { message: '로그아웃 성공' };
  }

  async rotateToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('유효하지 않은 토큰 타입입니다.');
      }

      // 변수 할당 없이 Redis 값과 바로 비교하여 최적화
      if (
        (await this.redis.get(`refresh_token:${payload.sub}`)) !== refreshToken
      ) {
        throw new UnauthorizedException(
          '만료되었거나 유효하지 않은 토큰입니다.',
        );
      }

      const user = await this.userService.getUserByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('유저를 찾을 수 없습니다.');
      }

      return this.loginUser(user);
    } catch {
      // 사용하지 않는 변수 e 제거
      throw new UnauthorizedException(
        '토큰이 만료되었거나 갱신에 실패했습니다.',
      );
    }
  }
}
