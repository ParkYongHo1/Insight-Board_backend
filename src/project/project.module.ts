import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectMemberModel } from './entities/project-member.entity';
import { ProjectModel } from './entities/project.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectModel, ProjectMemberModel]),
    JwtModule.register({}),
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
