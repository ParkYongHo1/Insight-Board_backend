import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { FinalizeRegistrationDto, InviteUserDto } from './dto/user.dto';
import { UserModel } from './entities/user.entity';
import { ProjectMemberModel } from 'src/project/entities/project-member.entity';
import { ProjectModel } from 'src/project/entities/project.entity'; // ProjectModel 임포트
import { UserRole } from './entities/user-role.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserModel)
    private readonly userRepository: Repository<UserModel>,
    @InjectRepository(ProjectMemberModel)
    private readonly projectMemberRepository: Repository<ProjectMemberModel>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 초대하기
   * 유저 생성과 동시에 프로젝트 멤버십(중간 테이블) 데이터를 생성합니다.
   */
  async inviteUsers(inviteList: InviteUserDto[]) {
    const emails = inviteList.map((d) => d.email);

    // 1. 중복 체크
    const existingUsers = await this.userRepository.find({
      where: { email: In(emails) },
    });

    if (existingUsers.length > 0) {
      const alreadyRegistered = existingUsers
        .filter((u) => u.password)
        .map((u) => u.email);

      if (alreadyRegistered.length > 0) {
        throw new BadRequestException(
          `이미 가입이 완료된 유저입니다: ${alreadyRegistered.join(', ')}`,
        );
      }

      const alreadyInvited = existingUsers
        .filter((u) => !u.password)
        .map((u) => u.email);

      if (alreadyInvited.length > 0) {
        throw new BadRequestException(
          `이미 초대 대기 중인 유저입니다: ${alreadyInvited.join(', ')}`,
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedUsers: UserModel[] = [];

      for (const dto of inviteList) {
        const user = this.userRepository.create({
          email: dto.email,
          companyId: dto.companyId,
          role: dto.role || UserRole.VIEWER,
        });
        const savedUser = await queryRunner.manager.save(user);

        if (dto.projectId) {
          const membership = new ProjectMemberModel();
          membership.user = savedUser;

          // ✅ any 없이 ProjectModel 타입으로 단언하여 할당
          // TypeORM은 관계 설정 시 ID 값만 있는 부분 객체도 허용합니다.
          membership.project = { id: dto.projectId } as ProjectModel;

          membership.role = dto.role || UserRole.VIEWER;

          await queryRunner.manager.save(membership);
        }

        savedUsers.push(savedUser);
      }

      await queryRunner.commitTransaction();
      return savedUsers;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 가입 완료 (이름, 비번 업데이트)
   */
  async finalizeRegistration(email: string, dto: FinalizeRegistrationDto) {
    const user = await this.getUserByEmail(email);

    if (!user) {
      throw new BadRequestException('초대된 유저가 아닙니다.');
    }

    Object.assign(user, dto);

    return await this.userRepository.save(user);
  }

  /**
   * 유저 상세 정보 조회 (기업 및 프로젝트 조인)
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
}
