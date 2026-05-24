import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import {
  AccessTokenGuard,
  JwtPayload,
} from 'src/auth/guard/access-token.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request } from 'express';
import { CreateProjectDto } from './dto/create-project.dto';

@ApiTags('02. 프로젝트 (Project)')
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @UseGuards(AccessTokenGuard)
  @Post()
  @ApiOperation({ summary: '새 프로젝트 생성' })
  async createProject(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.projectService.createProject(dto, userId);
  }

  @UseGuards(AccessTokenGuard)
  @Get(':projectId/members')
  @ApiOperation({ summary: '프로젝트 멤버 조회' })
  async getProjectMembers(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: Request,
  ) {
    const { sub: userId } = req.user as JwtPayload;
    return await this.projectService.getProjectMembers(projectId, userId);
  }
}
