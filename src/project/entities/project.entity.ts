import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { ProjectMemberModel } from './project-member.entity';

// --------------------------------------
// TYPES
// --------------------------------------

export interface ProjectColumn {
  key: string;
  type: 'string' | 'number';
}

export interface ProjectMetric {
  column: string;
  alias: string;
  value: string | number;
  condition: '>=' | '<=' | '==' | '>' | '<';
  method: 'COUNT' | 'SUM';
}

export interface ProjectGroup {
  key: string;
  value: string;
  alias: string;
}

// --------------------------------------
// ENTITY
// --------------------------------------

@Entity('project_model')
export class ProjectModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @OneToMany(() => ProjectMemberModel, (membership) => membership.project)
  members!: ProjectMemberModel[];

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;

  @Column({ nullable: true })
  apiType?: string;

  @Column({ nullable: true })
  apiUrl?: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  apiHeaders?: Record<string, string>;

  // --------------------------------------
  // METRICS
  // --------------------------------------

  @Column({
    type: 'jsonb',
    default: [],
  })
  metrics!: ProjectMetric[];

  // --------------------------------------
  // GROUPS
  // --------------------------------------

  @Column({
    type: 'jsonb',
    default: [],
  })
  groups!: ProjectGroup[];

  // --------------------------------------
  // COLUMNS
  // --------------------------------------

  @Column({
    type: 'jsonb',
    default: [],
  })
  columns!: ProjectColumn[];
}
