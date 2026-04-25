// project.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProjectMemberModel } from './project-member.entity';

@Entity('project_model') // 테이블명 명시
export class ProjectModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  /**
   * [수정] 직접 UserModel을 참조하지 않고 중간 테이블을 참조합니다.
   */
  @OneToMany(() => ProjectMemberModel, (membership) => membership.project)
  members: ProjectMemberModel[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
