import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardModel } from './entities/dashboard.entity';
import { CreateDashboardDto } from './dto/create-dashboard.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(DashboardModel)
    private readonly dashboardRepository: Repository<DashboardModel>,
  ) {}

  async create(userId: number, dto: CreateDashboardDto) {
    const dashboard = this.dashboardRepository.create({
      ...dto,
      userId: userId,
    });
    return await this.dashboardRepository.save(dashboard);
  }

  async findAllByUser(userId: number) {
    return await this.dashboardRepository.find({
      where: {
        userId: userId,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId: number) {
    const d = await this.dashboardRepository.findOne({ where: { id } });
    if (!d) throw new NotFoundException('대시보드를 찾을 수 없습니다.');

    if (d.userId !== userId) {
      throw new ForbiddenException('이 대시보드에 접근할 권한이 없습니다.');
    }
    return d;
  }

  async update(id: number, userId: number, dto: CreateDashboardDto) {
    await this.findOne(id, userId);

    await this.dashboardRepository.update(id, dto);
    return this.findOne(id, userId);
  }

  async remove(id: number, userId: number) {
    // 본인 대시보드가 맞는지 먼저 검증 후 가져오기
    const d = await this.findOne(id, userId);

    await this.dashboardRepository.remove(d);
    return { ok: true };
  }

  onModuleDestroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }
}
