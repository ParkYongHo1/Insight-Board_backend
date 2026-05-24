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
   * 🚀 사용자 관심 분석 테마 필드 추가
   */
  @Column({ name: 'interest_theme', default: 'SPACE_AEROSPACE' })
  interestTheme: string;

  @ManyToOne(() => CompanyModel, (company) => company.users, {
    nullable: false,
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyModel;

  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @OneToMany(() => ProjectMemberModel, (membership) => membership.user)
  projectMemberships: ProjectMemberModel[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'slack_user_id' })
  slackUserId?: string;
}
