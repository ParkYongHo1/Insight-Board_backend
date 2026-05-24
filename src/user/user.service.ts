import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserModel } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { SignUpDto } from './dto/user.dto';
interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  authed_user?: {
    id: string;
  };
}
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserModel)
    private readonly userRepository: Repository<UserModel>,
  ) {}

  /**
   * 유저 이메일 조회 (인증 시스템 및 세션 연동)
   */
  async getUserByEmail(email: string) {
    return await this.userRepository.findOne({
      where: { email },
      relations: [
        'company',
        'projectMemberships',
        'projectMemberships.project',
      ],
    });
  }
  /**
   * 🚀 [추가] 유저 이름 조회 (이름 중복 체크용)
   */
  async getUserByName(name: string) {
    return await this.userRepository.findOne({
      where: { name },
    });
  }

  async updateName(userId: number, name: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('유저를 찾을 수 없습니다.');

    if (user.name === name) {
      return { message: '이전과 동일한 이름입니다.', name };
    }

    const isNameExist = await this.getUserByName(name);
    if (isNameExist) {
      throw new BadRequestException(
        '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.',
      );
    }

    user.name = name;
    await this.userRepository.save(user);

    return { message: '이름이 변경되었습니다.', name };
  }

  /**
   * 내 정보 페이지 내 비밀번호 변경 처리
   */
  async updatePassword(
    userId: number,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('비밀번호가 일치하지 않습니다.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('유저를 찾을 수 없습니다.');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await this.userRepository.save(user);

    return { message: '비밀번호가 변경되었습니다.' };
  }

  async finalizeRegistration(dto: SignUpDto) {
    const user = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });

    await this.userRepository.save(user);
    return user;
  }

  async connectSlack(
    userId: number,
    code: string,
  ): Promise<{ message: string }> {
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
        redirect_uri: redirectUri ?? '',
      }),
    });

    const tokenData = (await tokenRes.json()) as SlackOAuthResponse;

    if (!tokenData.ok) {
      throw new BadRequestException(`Slack 연동 실패: ${tokenData.error}`);
    }

    const slackUserId = tokenData.authed_user?.id;
    if (!slackUserId) {
      throw new BadRequestException('Slack user_id를 가져올 수 없습니다.');
    }

    await this.userRepository.update(userId, { slackUserId });
    return { message: 'Slack 연동이 완료되었습니다.' };
  }

  async disconnectSlack(userId: number): Promise<{ message: string }> {
    await this.userRepository.update(userId, { slackUserId: undefined });
    return { message: 'Slack 연동이 해제되었습니다.' };
  }

  async getSlackStatus(
    userId: number,
  ): Promise<{ connected: boolean; slackUserId: string | null }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return {
      connected: !!user?.slackUserId,
      slackUserId: user?.slackUserId ?? null,
    };
  }
}
