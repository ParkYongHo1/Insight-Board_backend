import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { AccessTokenGuard } from 'src/auth/guard/access-token.guard';
import { JwtPayload } from 'src/auth/guard/access-token.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request } from 'express';

@ApiTags('02. 프로젝트 (Project)')
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

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
