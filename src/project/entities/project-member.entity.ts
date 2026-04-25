import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from 'typeorm';
import { UserModel } from 'src/user/entities/user.entity';
import { ProjectModel } from 'src/project/entities/project.entity';
import { UserRole } from 'src/user/entities/user-role.enum';

@Entity('project_members')
export class ProjectMemberModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserModel, (user) => user.projectMemberships)
  @JoinColumn({ name: 'user_id' })
  user: UserModel;

  @ManyToOne(() => ProjectModel, (project) => project.members)
  @JoinColumn({ name: 'project_id' })
  project: ProjectModel;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;
}
