import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMemberModel } from './entities/project-member.entity';
import { ProjectColumn, ProjectModel } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UserRole } from 'src/user/entities/user-role.enum';
import { UserModel } from 'src/user/entities/user.entity';

// 주식 데이터 기본 컬럼 정의
const STOCK_DEFAULT_COLUMNS: ProjectColumn[] = [
  { key: 'ticker', type: 'string' },
  { key: 'companyName', type: 'string' },
  { key: 'price', type: 'number' },
  { key: 'changePercent', type: 'number' },
  { key: 'above50MA', type: 'number' },
  { key: 'above200MA', type: 'number' },
  { key: 'ma50', type: 'number' },
  { key: 'ma200', type: 'number' },
  { key: 'purchaseZone', type: 'string' },
];
@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectMemberModel)
    private readonly projectMemberRepository: Repository<ProjectMemberModel>,
    @InjectRepository(ProjectModel)
    private readonly projectRepository: Repository<ProjectModel>,
  ) {}

  async createProject(dto: CreateProjectDto, userId: number) {
    const newProject = this.projectRepository.create({
      name: dto.name,
      description: dto.description,
      apiType: 'stock',
      columns: STOCK_DEFAULT_COLUMNS,
      groups: [],
      metrics: [],
    });

    const savedProject = await this.projectRepository.save(newProject);

    const membership = this.projectMemberRepository.create({
      project: savedProject,
      user: { id: userId } as UserModel,
      role: UserRole.ADMIN,
    });

    await this.projectMemberRepository.save(membership);

    return savedProject;
  }

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
