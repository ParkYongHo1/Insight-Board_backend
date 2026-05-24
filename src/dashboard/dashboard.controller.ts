import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '@/auth/guard/access-token.guard';
import { Request } from 'express';

@ApiTags('02. 대시보드 (Dashboard)')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '대시보드 생성' })
  async create(
    @Req() req: Request,
    @Body() createDashboardDto: CreateDashboardDto,
  ) {
    const userId = req.user!.sub;
    return await this.dashboardService.create(userId, createDashboardDto);
  }

  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '로그인 유저 기준 대시보드 목록 조회' })
  async findAll(@Req() req: Request) {
    const userId = req.user!.sub;
    return await this.dashboardService.findAllByUser(userId);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '대시보드 상세 조회' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = req.user!.sub;
    return await this.dashboardService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '대시보드 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Body() updateDto: CreateDashboardDto,
  ) {
    const userId = req.user!.sub;
    return await this.dashboardService.update(id, userId, updateDto);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '대시보드 삭제' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = req.user!.sub;
    return await this.dashboardService.remove(id, userId);
  }
}
