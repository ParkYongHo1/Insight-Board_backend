import { CompanyModel } from 'src/company/entities/company.entity';
import { ProjectMemberModel } from 'src/project/entities/project-member.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserRole } from './user-role.enum';

@Entity('users')
export class UserModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  password?: string;

  /**
   * 소속 회사 관계 (N:1)
   */
  @ManyToOne(() => CompanyModel, (company) => company.users, {
    nullable: false,
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyModel;

  @Column({ name: 'company_id' })
  companyId: number;

  /**
   * 유저의 기본 권한
   */
  @Column({ type: 'enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  /**
   * [중요 수정사항]
   * 기존 @ManyToOne project 및 projectId 컬럼을 삭제하고 아래로 대체합니다.
   * 유저가 속한 여러 프로젝트의 멤버십 리스트를 가져옵니다.
   */
  @OneToMany(() => ProjectMemberModel, (membership) => membership.user)
  projectMemberships: ProjectMemberModel[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
