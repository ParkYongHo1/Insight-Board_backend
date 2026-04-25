import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserModel } from './entities/user.entity'; // 엔티티 경로 확인
import { ProjectMemberModel } from 'src/project/entities/project-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserModel, ProjectMemberModel])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
