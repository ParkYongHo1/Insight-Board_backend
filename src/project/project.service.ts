// project.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMemberModel } from './entities/project-member.entity';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectMemberModel)
    private readonly projectMemberRepository: Repository<ProjectMemberModel>,
  ) {}

  async getProjectMembers(projectId: number, userId: number) {
    const requester = await this.projectMemberRepository.findOne({
      where: { project: { id: projectId }, user: { id: userId } },
    });

    if (!requester) {
      throw new ForbiddenException('해당 프로젝트에 접근 권한이 없습니다.');
    }

    const members = await this.projectMemberRepository.find({
      where: { project: { id: projectId } },
      relations: ['user'],
    });

    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      status: m.user.password ? 'ACTIVE' : 'PENDING',
    }));
  }
}
